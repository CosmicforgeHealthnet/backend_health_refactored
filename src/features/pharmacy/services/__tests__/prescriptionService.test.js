/* eslint-env jest */
// Targeted unit tests for prescriptionService — this file is large (~1260
// lines) covering the full prescription lifecycle (doctor creation -> patient
// upload -> pharmacy assignment -> processing -> ready -> completed/cancelled)
// plus dispatch/delivery and driver assignment. Given the size, this suite
// prioritizes the riskiest branches rather than full line coverage:
// status-transition guards, ownership/RBAC checks, and the one real bug
// found below. Thin read-only wrappers (getDoctorPrescriptions,
// searchPrescriptions, getPharmacyContacts, etc.) are NOT tested — they are
// single-line passthroughs to the repository with no branching logic.
//
// BUG FOUND & FIXED: assignDriver (prescriptionService.js, previously around
// line 1218) called `prescriptionRepo.findOne(...)` and
// `prescriptionRepo.update(...)` directly on the PrescriptionRepository
// wrapper instance. That class (src/features/pharmacy/repositories/
// prescriptionRepository.js) does NOT define findOne or update — only the
// raw TypeORM repo behind its `.repo` getter does, and every other method in
// both the repo and this service goes through the wrapper's own
// findById/updateFields. Calling assignDriver would have thrown
// "prescriptionRepo.findOne is not a function" 100% of the time. It has zero
// callers anywhere in the codebase today (grepped — no controller/route
// wires it up), so this had no live impact, but it's fixed here (switched to
// findById/updateFields, matching every other method in this file) so it
// works whenever a driver-assignment endpoint is added.

jest.mock('../../../../config/database');
jest.mock('../../repositories/prescriptionRepository');
jest.mock('../../repositories/pharmacyProfileRepository');
jest.mock('../../../auth/repositories/userRepository');
jest.mock('../../../appointments/repositories/appointmentRepository');
jest.mock('../../../notifications/services/notificationService');
jest.mock('../../../../shared/services/email/helper/pharmacy');
jest.mock('../../../../shared/services/adminSettingsService');
jest.mock('../../../../config/websocket');

const AppDataSource        = require('../../../../config/database');
const prescriptionRepo     = require('../../repositories/prescriptionRepository');
const pharmacyProfileRepo  = require('../../repositories/pharmacyProfileRepository');
const userRepo             = require('../../../auth/repositories/userRepository');
const AppointmentRepository = require('../../../appointments/repositories/appointmentRepository');
const NotificationService  = require('../../../notifications/services/notificationService');
const pharmacyEmailHelper  = require('../../../../shared/services/email/helper/pharmacy');
const adminSettingsService = require('../../../../shared/services/adminSettingsService');
const websocket            = require('../../../../config/websocket');

// prescriptionService.js builds its own module-scoped singletons —
// `const notificationService = new NotificationService();` and
// `const appointmentRepo = new AppointmentRepository();` — the moment it is
// required below. Jest's automock, when a class instance is constructed,
// copies each prototype method onto that instance as an OWN property at
// construction time. That means reassigning `NotificationService.prototype
// .createNotification` (or similar) *after* the singleton already exists —
// e.g. from inside `beforeEach`, which runs per-test, long after this file's
// one-time `require('../prescriptionService')` — never reaches the instance
// prescriptionService.js actually calls: it silently keeps the default
// automock stub, which returns `undefined` instead of a Promise. That is
// exactly what caused `notificationService.createNotification(...).catch(...)`
// to throw "Cannot read properties of undefined (reading 'catch')" in every
// method that fires a notification (initiateDispatch, markDelivered,
// confirmAvailability, proposeAlternative, approveAlternative,
// rejectAlternative, cancelPrescription, etc.) — 17 tests failed this way.
//
// Fix: configure the prototype mocks BEFORE prescriptionService.js is
// required, so the singletons are constructed with the resolved-value mock
// already in place. `jest.clearAllMocks()` in beforeEach only clears call
// history (mock.calls/results) via mockClear — it does NOT reset a mock's
// configured implementation — so a single mockResolvedValue set up here
// persists correctly across every test in this file.
NotificationService.prototype.createNotification = jest.fn().mockResolvedValue(undefined);
AppointmentRepository.prototype.findById = jest.fn().mockResolvedValue(null);

const prescriptionService = require('../prescriptionService');

const DOCTOR_ID   = 'aaaa0000-0000-0000-0000-000000000001';
const PATIENT_ID  = 'bbbb0000-0000-0000-0000-000000000002';
const PHARMACY_ID = 'cccc0000-0000-0000-0000-000000000003';
const RX_ID       = 'dddd0000-0000-0000-0000-000000000004';
const DRIVER_ID   = 'eeee0000-0000-0000-0000-000000000005';

function makeRx(overrides = {}) {
  return {
    id: RX_ID, reference: 'RX-1', doctorId: DOCTOR_ID, patientId: PATIENT_ID, pharmacyId: null,
    status: 'pending', paymentStatus: 'unpaid', internalNotes: [], fulfillmentHistory: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  prescriptionRepo.generateReference = jest.fn().mockResolvedValue('RX-1');
  prescriptionRepo.save = jest.fn().mockImplementation(async (data) => ({ id: RX_ID, ...data }));
  prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx());
  prescriptionRepo.updateStatus = jest.fn().mockResolvedValue(undefined);
  prescriptionRepo.updateFields = jest.fn().mockResolvedValue(undefined);
  prescriptionRepo.updatePayment = jest.fn().mockResolvedValue(undefined);
  prescriptionRepo.addFulfillmentHistory = jest.fn().mockResolvedValue(undefined);
  prescriptionRepo.addChatMessage = jest.fn().mockResolvedValue(undefined);
  prescriptionRepo.findByPharmacyId = jest.fn().mockResolvedValue([]);

  pharmacyProfileRepo.findById = jest.fn().mockResolvedValue({
    id: PHARMACY_ID, userId: 'pharmacy-user-1', pharmacyName: 'Test Pharmacy', email: 'p@example.com',
    verificationStatus: 'approved',
  });
  pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue({ id: PHARMACY_ID });

  userRepo.findById = jest.fn().mockImplementation(async (id) => {
    if (id === DOCTOR_ID) return { id: DOCTOR_ID, role: 'doctor', fullName: 'Dr. Smith', email: 'doc@example.com' };
    if (id === PATIENT_ID) return { id: PATIENT_ID, role: 'patient', fullName: 'Jane Doe', email: 'patient@example.com' };
    return { id, fullName: 'Someone', email: 'someone@example.com' };
  });

  // NotificationService.prototype.createNotification and
  // AppointmentRepository.prototype.findById are configured once, above,
  // before prescriptionService.js's module-scoped singletons are
  // constructed (see the comment by that require) — reassigning them here
  // would be a no-op. jest.clearAllMocks() above already clears their call
  // history for each test while leaving the mockResolvedValue in place.

  pharmacyEmailHelper.sendPrescriptionAssignedToPharmacyEmail = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendInvoiceReadyEmail = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendPrescriptionReadyEmail = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendPrescriptionCompletedEmail = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendPrescriptionCancelledEmail = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendAvailabilityConfirmedEmail = jest.fn().mockResolvedValue(undefined);
  pharmacyEmailHelper.sendAlternativeSuggestedEmail = jest.fn().mockResolvedValue(undefined);

  adminSettingsService.getSetting.mockResolvedValue({ enabled: false, value: 0 });

  websocket.getIO = jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) }));

  AppDataSource.query = jest.fn().mockResolvedValue([{ count: '0' }]);
});

// ============================================================================
// createPrescription
// ============================================================================

describe('createPrescription', () => {
  const VALID_MED = { name: 'Panadol', dosage: '500mg', frequency: 'twice daily', duration: '5 days', quantity: 10, route: 'oral' };

  test('rejects missing patientId or medications', async () => {
    await expect(prescriptionService.createPrescription({ medications: [VALID_MED] }, DOCTOR_ID)).rejects.toMatchObject({ status: 400 });
    await expect(prescriptionService.createPrescription({ patientId: PATIENT_ID, medications: [] }, DOCTOR_ID)).rejects.toMatchObject({ status: 400 });
  });

  test('rejects when the creator is not a doctor', async () => {
    userRepo.findById = jest.fn().mockResolvedValue({ id: DOCTOR_ID, role: 'patient' });
    await expect(prescriptionService.createPrescription({ patientId: PATIENT_ID, medications: [VALID_MED] }, DOCTOR_ID))
      .rejects.toMatchObject({ status: 403 });
  });

  test('rejects when the patient does not exist', async () => {
    userRepo.findById = jest.fn()
      .mockResolvedValueOnce({ id: DOCTOR_ID, role: 'doctor', fullName: 'Dr. Smith' })
      .mockResolvedValueOnce(null);
    await expect(prescriptionService.createPrescription({ patientId: PATIENT_ID, medications: [VALID_MED] }, DOCTOR_ID))
      .rejects.toMatchObject({ status: 404 });
  });

  test('rejects a medication missing required fields', async () => {
    await expect(
      prescriptionService.createPrescription({ patientId: PATIENT_ID, medications: [{ name: 'Panadol' }] }, DOCTOR_ID)
    ).rejects.toMatchObject({ status: 400 });
  });

  test('creates the prescription as PENDING/UNPAID with a fulfillment history entry', async () => {
    await prescriptionService.createPrescription({ patientId: PATIENT_ID, medications: [VALID_MED] }, DOCTOR_ID);
    expect(prescriptionRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending', paymentStatus: 'unpaid',
      fulfillmentHistory: [expect.objectContaining({ status: 'pending' })],
    }));
  });
});

// ============================================================================
// uploadPrescription
// ============================================================================

describe('uploadPrescription', () => {
  test('throws 404 when prescription not found', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(null);
    await expect(prescriptionService.uploadPrescription(RX_ID, PATIENT_ID)).rejects.toMatchObject({ status: 404 });
  });

  test('throws 403 when it belongs to a different patient', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ patientId: 'someone-else' }));
    await expect(prescriptionService.uploadPrescription(RX_ID, PATIENT_ID)).rejects.toMatchObject({ status: 403 });
  });

  test('throws 422 when not in pending status', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ status: 'patient_uploaded' }));
    await expect(prescriptionService.uploadPrescription(RX_ID, PATIENT_ID)).rejects.toMatchObject({ status: 422 });
  });

  test('transitions pending -> patient_uploaded', async () => {
    await prescriptionService.uploadPrescription(RX_ID, PATIENT_ID);
    expect(prescriptionRepo.updateStatus).toHaveBeenCalledWith(RX_ID, 'patient_uploaded');
  });
});

// ============================================================================
// assignPharmacy
// ============================================================================

describe('assignPharmacy', () => {
  test('throws 403 for a prescription that is not the caller\'s', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ patientId: 'someone-else' }));
    await expect(prescriptionService.assignPharmacy(RX_ID, PHARMACY_ID, PATIENT_ID)).rejects.toMatchObject({ status: 403 });
  });

  test('rejects an unapproved pharmacy', async () => {
    pharmacyProfileRepo.findById = jest.fn().mockResolvedValue({ id: PHARMACY_ID, verificationStatus: 'under_review' });
    await expect(prescriptionService.assignPharmacy(RX_ID, PHARMACY_ID, PATIENT_ID)).rejects.toMatchObject({ status: 400 });
  });

  test('rejects a nonexistent pharmacy', async () => {
    pharmacyProfileRepo.findById = jest.fn().mockResolvedValue(null);
    await expect(prescriptionService.assignPharmacy(RX_ID, PHARMACY_ID, PATIENT_ID)).rejects.toMatchObject({ status: 400 });
  });

  test.each(['pharmacy_assigned', 'pharmacy_processing', 'completed', 'cancelled'])(
    'refuses reassignment once the prescription has moved past pending/patient_uploaded (status "%s")',
    async (status) => {
      prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ status }));
      await expect(prescriptionService.assignPharmacy(RX_ID, PHARMACY_ID, PATIENT_ID)).rejects.toMatchObject({ status: 422 });
    }
  );

  test('assigns the pharmacy and moves to pharmacy_assigned', async () => {
    await prescriptionService.assignPharmacy(RX_ID, PHARMACY_ID, PATIENT_ID, { address: '1 Main St', instructions: 'Ring bell' });
    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, expect.objectContaining({
      pharmacyId: PHARMACY_ID, status: 'pharmacy_assigned',
      deliveryAddress: '1 Main St', deliveryInstructions: 'Ring bell',
    }));
  });
});

// ============================================================================
// startProcessing
// ============================================================================

describe('startProcessing', () => {
  test('throws 403 when the prescription is not assigned to this pharmacy', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: 'someone-else' }));
    await expect(prescriptionService.startProcessing(RX_ID, PHARMACY_ID, 'pharmacist-1')).rejects.toMatchObject({ status: 403 });
  });

  test('throws 422 unless status is pharmacy_assigned', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, status: 'pending' }));
    await expect(prescriptionService.startProcessing(RX_ID, PHARMACY_ID, 'pharmacist-1')).rejects.toMatchObject({ status: 422 });
  });

  test('throws 404 when the pharmacist does not exist', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, status: 'pharmacy_assigned' }));
    userRepo.findById = jest.fn().mockResolvedValue(null);
    await expect(prescriptionService.startProcessing(RX_ID, PHARMACY_ID, 'pharmacist-1')).rejects.toMatchObject({ status: 404 });
  });

  test('transitions pharmacy_assigned -> pharmacy_processing and assigns the pharmacist', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, status: 'pharmacy_assigned' }));
    await prescriptionService.startProcessing(RX_ID, PHARMACY_ID, 'pharmacist-1');
    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, {
      status: 'pharmacy_processing', assignedPharmacistId: 'pharmacist-1',
    });
  });
});

// ============================================================================
// provideCosts — the only money math left in this file
// ============================================================================

describe('provideCosts', () => {
  test('throws 403 when not assigned to this pharmacy', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: 'someone-else' }));
    await expect(prescriptionService.provideCosts(RX_ID, PHARMACY_ID, { items: [] })).rejects.toMatchObject({ status: 403 });
  });

  test('computes totalDue as sum(unitPrice * quantity) + deliveryFee', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID }));
    await prescriptionService.provideCosts(RX_ID, PHARMACY_ID, {
      items: [{ unitPrice: 100, quantity: 3 }, { unitPrice: 50, quantity: 2 }],
      deliveryFee: 200,
      paymentMethod: 'online',
    });

    // (100*3) + (50*2) + 200 = 300 + 100 + 200 = 600
    expect(prescriptionRepo.updatePayment).toHaveBeenCalledWith(RX_ID, expect.objectContaining({
      totalDue: 600, deliveryFee: 200, paymentStatus: 'unpaid',
    }));
  });

  test('defaults deliveryFee to 0 when omitted', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID }));
    await prescriptionService.provideCosts(RX_ID, PHARMACY_ID, { items: [{ unitPrice: 20, quantity: 1 }] });
    expect(prescriptionRepo.updatePayment).toHaveBeenCalledWith(RX_ID, expect.objectContaining({ totalDue: 20, deliveryFee: 0 }));
  });
});

// ============================================================================
// markReady / completePrescription
// ============================================================================

describe('markReady', () => {
  test.each(['pending', 'pharmacy_assigned', 'ready_for_pickup', 'completed'])(
    'refuses when the prescription is not processing/in_progress (status "%s")',
    async (status) => {
      prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, status }));
      await expect(prescriptionService.markReady(RX_ID, PHARMACY_ID, 'pickup')).rejects.toMatchObject({ status: 422 });
    }
  );

  test('readyType "delivery" -> out_for_delivery, "pickup" -> ready_for_pickup', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, status: 'pharmacy_processing' }));
    await prescriptionService.markReady(RX_ID, PHARMACY_ID, 'delivery');
    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, expect.objectContaining({ status: 'out_for_delivery' }));

    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, status: 'in_progress' }));
    await prescriptionService.markReady(RX_ID, PHARMACY_ID, 'pickup');
    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, expect.objectContaining({ status: 'ready_for_pickup' }));
  });
});

describe('completePrescription', () => {
  test.each(['pending', 'pharmacy_processing'])('refuses completion from status "%s"', async (status) => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, status }));
    await expect(prescriptionService.completePrescription(RX_ID, PHARMACY_ID)).rejects.toMatchObject({ status: 422 });
  });

  test('completes from ready_for_pickup or out_for_delivery, marking payment PAID', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, status: 'ready_for_pickup' }));
    await prescriptionService.completePrescription(RX_ID, PHARMACY_ID);
    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, expect.objectContaining({
      status: 'completed', paymentStatus: 'paid',
    }));
  });
});

// ============================================================================
// cancelPrescription — authorization + terminal-state guards
// ============================================================================

describe('cancelPrescription', () => {
  test('throws 403 when the caller has no relationship to the prescription', async () => {
    await expect(prescriptionService.cancelPrescription(RX_ID, 'random-user', 'changed my mind'))
      .rejects.toMatchObject({ status: 403 });
  });

  test('refuses to cancel a completed prescription', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ status: 'completed' }));
    await expect(prescriptionService.cancelPrescription(RX_ID, PATIENT_ID, 'x')).rejects.toMatchObject({ status: 422 });
  });

  test('refuses to re-cancel an already-cancelled prescription', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ status: 'cancelled' }));
    await expect(prescriptionService.cancelPrescription(RX_ID, PATIENT_ID, 'x')).rejects.toMatchObject({ status: 409 });
  });

  test('allows the patient, the prescribing doctor, or the assigned pharmacy to cancel', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID }));
    await expect(prescriptionService.cancelPrescription(RX_ID, PATIENT_ID, 'x')).resolves.toBeDefined();
    await expect(prescriptionService.cancelPrescription(RX_ID, DOCTOR_ID, 'x')).resolves.toBeDefined();
    await expect(prescriptionService.cancelPrescription(RX_ID, PHARMACY_ID, 'x')).resolves.toBeDefined();
  });

  test('correctly attributes cancelledBy based on which identity matches', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID }));
    await prescriptionService.cancelPrescription(RX_ID, PHARMACY_ID, 'out of stock');
    expect(prescriptionRepo.addFulfillmentHistory).toHaveBeenCalledWith(RX_ID, expect.objectContaining({
      note: expect.stringContaining('Cancelled by pharmacy: out of stock'),
    }));
  });

  test('sets paymentStatus to CANCELLED alongside status', async () => {
    await prescriptionService.cancelPrescription(RX_ID, PATIENT_ID, 'x');
    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, { status: 'cancelled', paymentStatus: 'cancelled' });
  });

  test('does not notify the same party that performed the cancellation', async () => {
    await prescriptionService.cancelPrescription(RX_ID, PATIENT_ID, 'x');
    // Only doctor gets notified (pharmacyId is null on the default makeRx) — patient does not notify itself
    expect(NotificationService.prototype.createNotification).not.toHaveBeenCalledWith(
      PATIENT_ID, expect.anything(), expect.anything(), expect.anything()
    );
  });
});

// ============================================================================
// getPrescriptionById — RBAC + internalNotes visibility
// ============================================================================

describe('getPrescriptionById', () => {
  test('returns null for a nonexistent prescription', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(null);
    expect(await prescriptionService.getPrescriptionById(RX_ID)).toBeNull();
  });

  test('a patient can view their own prescription', async () => {
    await expect(prescriptionService.getPrescriptionById(RX_ID, PATIENT_ID, 'patient')).resolves.toBeDefined();
  });

  test('a patient cannot view someone else\'s prescription', async () => {
    await expect(prescriptionService.getPrescriptionById(RX_ID, 'someone-else', 'patient')).rejects.toMatchObject({ status: 403 });
  });

  test('a doctor cannot view a prescription they did not write', async () => {
    await expect(prescriptionService.getPrescriptionById(RX_ID, 'someone-else', 'doctor')).rejects.toMatchObject({ status: 403 });
  });

  test('a pharmacy user can only view prescriptions assigned to their own pharmacy profile', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID }));
    pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue({ id: 'a-different-pharmacy' });
    await expect(prescriptionService.getPrescriptionById(RX_ID, 'pharmacy-user-1', 'pharmacy')).rejects.toMatchObject({ status: 403 });
  });

  test('a pharmacy user with a matching profile can view it', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID }));
    pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue({ id: PHARMACY_ID });
    await expect(prescriptionService.getPrescriptionById(RX_ID, 'pharmacy-user-1', 'pharmacy')).resolves.toBeDefined();
  });

  test('strips internalNotes for non-pharmacy roles but keeps them for pharmacy', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ internalNotes: [{ note: 'secret staff note' }] }));
    const forPatient = await prescriptionService.getPrescriptionById(RX_ID, PATIENT_ID, 'patient');
    expect(forPatient.internalNotes).toBeUndefined();

    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, internalNotes: [{ note: 'secret staff note' }] }));
    pharmacyProfileRepo.findByUserId = jest.fn().mockResolvedValue({ id: PHARMACY_ID });
    const forPharmacy = await prescriptionService.getPrescriptionById(RX_ID, 'pharmacy-user-1', 'pharmacy');
    expect(forPharmacy.internalNotes).toEqual([{ note: 'secret staff note' }]);
  });

  test('skips RBAC entirely when called internally without userId/role', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ patientId: 'anyone' }));
    await expect(prescriptionService.getPrescriptionById(RX_ID)).resolves.toBeDefined();
  });
});

// ============================================================================
// confirmAvailability — idempotency guard
// ============================================================================

describe('confirmAvailability', () => {
  test('is idempotent: calling it again after already-confirmed does not duplicate history', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, availabilityStatus: 'confirmed' }));
    await prescriptionService.confirmAvailability(RX_ID, PHARMACY_ID);
    expect(prescriptionRepo.updateFields).not.toHaveBeenCalled();
    expect(prescriptionRepo.addFulfillmentHistory).not.toHaveBeenCalled();
  });

  test('confirms availability and auto-starts processing', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, availabilityStatus: 'pending' }));
    await prescriptionService.confirmAvailability(RX_ID, PHARMACY_ID);
    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, {
      availabilityStatus: 'confirmed', status: 'pharmacy_processing',
    });
  });
});

// ============================================================================
// proposeAlternative / approveAlternative / rejectAlternative
// ============================================================================

describe('proposeAlternative', () => {
  test('requires at least one alternative', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID }));
    await expect(prescriptionService.proposeAlternative(RX_ID, PHARMACY_ID, [])).rejects.toMatchObject({ status: 400 });
  });

  test('appends to internalNotes without discarding prior entries', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(
      makeRx({ pharmacyId: PHARMACY_ID, internalNotes: [{ note: 'prior note' }] })
    );
    await prescriptionService.proposeAlternative(RX_ID, PHARMACY_ID, [{ name: 'Generic Panadol' }]);

    const call = prescriptionRepo.updateFields.mock.calls[0][1];
    expect(call.internalNotes).toHaveLength(2);
    expect(call.internalNotes[1]).toMatchObject({ type: 'alternative_proposal', alternatives: [{ name: 'Generic Panadol' }] });
  });
});

describe('approveAlternative / rejectAlternative', () => {
  test('approveAlternative: only the prescribing doctor may approve', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ availabilityStatus: 'alternatives_proposed' }));
    await expect(prescriptionService.approveAlternative(RX_ID, 'someone-else')).rejects.toMatchObject({ status: 403 });
  });

  test('approveAlternative: requires a pending proposal', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ availabilityStatus: 'pending' }));
    await expect(prescriptionService.approveAlternative(RX_ID, DOCTOR_ID)).rejects.toMatchObject({ status: 422 });
  });

  test('approveAlternative: sets availabilityStatus to confirmed', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ availabilityStatus: 'alternatives_proposed', pharmacyId: PHARMACY_ID }));
    await prescriptionService.approveAlternative(RX_ID, DOCTOR_ID);
    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, { availabilityStatus: 'confirmed' });
  });

  test('rejectAlternative: resets availabilityStatus to pending', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ availabilityStatus: 'alternatives_proposed', pharmacyId: PHARMACY_ID }));
    await prescriptionService.rejectAlternative(RX_ID, DOCTOR_ID, 'not suitable');
    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, { availabilityStatus: 'pending' });
  });
});

// ============================================================================
// updatePrescriptionStatus — generic status setter must validate against enum
// ============================================================================

describe('updatePrescriptionStatus', () => {
  test('throws 404 for a prescription not owned by this pharmacy', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: 'someone-else' }));
    await expect(prescriptionService.updatePrescriptionStatus(RX_ID, PHARMACY_ID, 'completed')).rejects.toMatchObject({ status: 404 });
  });

  test('rejects a status value outside the PrescriptionStatus enum', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID }));
    await expect(prescriptionService.updatePrescriptionStatus(RX_ID, PHARMACY_ID, 'made_up_status')).rejects.toMatchObject({ status: 400 });
  });

  test('accepts a valid enum status', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID }));
    await prescriptionService.updatePrescriptionStatus(RX_ID, PHARMACY_ID, 'pharmacy_processing');
    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, { status: 'pharmacy_processing' });
  });
});

// ============================================================================
// initiateDispatch — dispatchedAt immutability
// ============================================================================

describe('initiateDispatch', () => {
  test('throws 404 for wrong pharmacy', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: 'someone-else' }));
    await expect(prescriptionService.initiateDispatch(RX_ID, PHARMACY_ID)).rejects.toMatchObject({ status: 404 });
  });

  test('refuses to dispatch a prescription already dispatched (dispatchedAt is immutable)', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, dispatchedAt: new Date() }));
    await expect(prescriptionService.initiateDispatch(RX_ID, PHARMACY_ID)).rejects.toMatchObject({ status: 409 });
  });

  test('requires ready_for_pickup status', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, status: 'pharmacy_processing' }));
    await expect(prescriptionService.initiateDispatch(RX_ID, PHARMACY_ID)).rejects.toMatchObject({ status: 422 });
  });

  test('dispatches and sets dispatchedAt', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, status: 'ready_for_pickup' }));
    const result = await prescriptionService.initiateDispatch(RX_ID, PHARMACY_ID, { note: 'On the bike' });
    expect(result.status).toBe('out_for_delivery');
    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, expect.objectContaining({ status: 'out_for_delivery', dispatchedAt: expect.any(Date) }));
  });
});

// ============================================================================
// markDelivered
// ============================================================================

describe('markDelivered', () => {
  test('requires out_for_delivery status', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, status: 'ready_for_pickup' }));
    await expect(prescriptionService.markDelivered(RX_ID, PHARMACY_ID)).rejects.toMatchObject({ status: 422 });
  });

  test('marks delivered and completed', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ pharmacyId: PHARMACY_ID, status: 'out_for_delivery' }));
    const result = await prescriptionService.markDelivered(RX_ID, PHARMACY_ID);
    expect(result.status).toBe('completed');
    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, expect.objectContaining({ status: 'completed' }));
  });
});

// ============================================================================
// assignDriver — BUGFIX regression coverage
// ============================================================================

describe('assignDriver (bugfix regression)', () => {
  test('throws 404 when the prescription does not exist', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(null);
    await expect(prescriptionService.assignDriver(RX_ID, DRIVER_ID)).rejects.toMatchObject({ status: 404 });
    expect(prescriptionRepo.findById).toHaveBeenCalledWith(RX_ID);
  });

  test('rejects assignment when the prescription is not ready_for_pickup or out_for_delivery', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ status: 'pharmacy_processing' }));
    await expect(prescriptionService.assignDriver(RX_ID, DRIVER_ID)).rejects.toMatchObject({ status: 422 });
  });

  test('assigns the driver via findById/updateFields (not the nonexistent findOne/update) and transitions to out_for_delivery', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ status: 'ready_for_pickup' }));

    const result = await prescriptionService.assignDriver(RX_ID, DRIVER_ID);

    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, expect.objectContaining({
      driverId: DRIVER_ID, status: 'out_for_delivery',
    }));
    expect(result).toEqual({ prescriptionId: RX_ID, driverId: DRIVER_ID, status: 'out_for_delivery' });
  });

  test('preserves an existing dispatchedAt rather than overwriting it', async () => {
    const existingDispatchedAt = new Date('2026-01-01T00:00:00Z');
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ status: 'out_for_delivery', dispatchedAt: existingDispatchedAt }));

    await prescriptionService.assignDriver(RX_ID, DRIVER_ID);

    expect(prescriptionRepo.updateFields).toHaveBeenCalledWith(RX_ID, expect.objectContaining({ dispatchedAt: existingDispatchedAt }));
  });

  test('enforces the max-active-deliveries-per-driver limit when enabled', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ status: 'ready_for_pickup' }));
    adminSettingsService.getSetting.mockResolvedValue({ enabled: true, value: 2 });
    AppDataSource.query = jest.fn().mockResolvedValue([{ count: '2' }]);

    await expect(prescriptionService.assignDriver(RX_ID, DRIVER_ID)).rejects.toMatchObject({ status: 429 });
    expect(prescriptionRepo.updateFields).not.toHaveBeenCalled();
  });

  test('allows assignment when the driver is under the configured limit', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ status: 'ready_for_pickup' }));
    adminSettingsService.getSetting.mockResolvedValue({ enabled: true, value: 2 });
    AppDataSource.query = jest.fn().mockResolvedValue([{ count: '1' }]);

    await expect(prescriptionService.assignDriver(RX_ID, DRIVER_ID)).resolves.toBeDefined();
  });

  test('does not query the limit at all when the setting is disabled', async () => {
    prescriptionRepo.findById = jest.fn().mockResolvedValue(makeRx({ status: 'ready_for_pickup' }));
    adminSettingsService.getSetting.mockResolvedValue({ enabled: false, value: 5 });

    await prescriptionService.assignDriver(RX_ID, DRIVER_ID);
    expect(AppDataSource.query).not.toHaveBeenCalled();
  });
});
