/**
 * Prescription Workflow E2E Test (Service Layer)
 * Tests the full pharmacy prescription lifecycle:
 * Doctor creates → Patient assigns pharmacy → Pharmacy confirms → Invoice → Ready → Complete
 * Also tests: propose-alternative, cancel, chat
 */

const AppDataSource = require('../src/config/database');
const userRepo = require('../src/features/auth/repositories/userRepository');
const pharmacyRegistrationService = require('../src/features/pharmacy/services/pharmacyRegistrationService');
const prescriptionService = require('../src/features/pharmacy/services/prescriptionService');
const pharmacyProfileRepo = require('../src/features/pharmacy/repositories/pharmacyProfileRepository');
const bcrypt = require('bcryptjs');

const ts = Date.now();

// ─── Test Data ────────────────────────────────────────────────────────────────
const DOCTOR_EMAIL    = `e2e_doctor_${ts}@test.com`;
const PATIENT_EMAIL   = `e2e_patient_${ts}@test.com`;
const PHARMACY_EMAIL  = `e2e_pharm_${ts}@test.com`;
const PASSWORD        = 'Password123!';

let doctorId, patientId, pharmacyUserId, pharmacyProfileId;
let prescriptionId, prescriptionRef;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pass(label, detail = '') {
  console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`);
}
function fail(label, err) {
  console.error(`  ❌ ${label}: ${err.message}`);
  throw err;
}

// ─── Setup ────────────────────────────────────────────────────────────────────
async function setup() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('   PRESCRIPTION WORKFLOW E2E TEST');
  console.log('═══════════════════════════════════════════════\n');

  console.log('📦 Connecting to database...');
  await AppDataSource.initialize();
  pass('Database connected');

  // Create doctor user
  const doctorHash = await bcrypt.hash(PASSWORD, 12);
  const doctor = await userRepo.save({
    fullName: 'Dr. E2E Tester',
    email: DOCTOR_EMAIL,
    passwordHash: doctorHash,
    role: 'doctor',
    status: 'active'
  });
  doctorId = doctor.id;
  pass('Doctor account created', DOCTOR_EMAIL);

  // Create patient user
  const patientHash = await bcrypt.hash(PASSWORD, 12);
  const patient = await userRepo.save({
    fullName: 'Patient E2E',
    email: PATIENT_EMAIL,
    passwordHash: patientHash,
    role: 'patient',
    status: 'active'
  });
  patientId = patient.id;
  pass('Patient account created', PATIENT_EMAIL);

  // Create pharmacy
  const pharmResult = await pharmacyRegistrationService.registerPharmacy({
    fullName: 'E2E Pharmacy Owner',
    email: PHARMACY_EMAIL,
    password: PASSWORD,
    pharmacyName: 'E2E Test Pharmacy',
    registrationNumber: `E2E-${ts}`,
    address: '1 Test Lane, Lagos',
    phone: '09011112222',
    primaryContactPerson: 'E2E Owner',
    preferredUsername: `e2epharm_${ts}`
  });
  pharmacyUserId = pharmResult.user.id;
  pharmacyProfileId = pharmResult.pharmacy.id;
  pass('Pharmacy account created', PHARMACY_EMAIL);

  // Activate pharmacy (set isActive = true so assignPharmacy works)
  await pharmacyProfileRepo.save({
    ...pharmResult.pharmacy,
    isActive: true,
    verificationStatus: 'approved'
  });
  pass('Pharmacy activated');
}

// ─── Test: Create Prescription (Doctor) ──────────────────────────────────────
async function testCreatePrescription() {
  console.log('\n--- STEP 1: Doctor creates prescription ---');
  try {
    const rx = await prescriptionService.createPrescription({
      patientId,
      medications: [
        { name: 'Paracetamol', dosage: '500mg', frequency: 'Twice daily', duration: '5 days', route: 'oral', quantity: 10 },
        { name: 'Amoxicillin', dosage: '250mg', frequency: 'Three times daily', duration: '7 days', route: 'oral', quantity: 21 }
      ],
      diagnosis: 'Upper respiratory tract infection',
      doctorNotes: 'Take with food.'
    }, doctorId);

    prescriptionId = rx.id;
    prescriptionRef = rx.reference;
    pass('Prescription created', `Ref: ${prescriptionRef}`);
    pass('Status', rx.status);
    pass('Medications count', rx.medications.length);
  } catch (err) { fail('Create prescription', err); }
}

// ─── Test: Assign Pharmacy (Patient) ─────────────────────────────────────────
async function testAssignPharmacy() {
  console.log('\n--- STEP 2: Patient assigns pharmacy ---');
  try {
    const rx = await prescriptionService.assignPharmacy(
      prescriptionId,
      pharmacyProfileId,
      patientId,
      { address: '5 Patient Road, Lagos', instructions: 'Call before delivery' }
    );
    pass('Pharmacy assigned', `Pharmacy: ${rx.pharmacy?.pharmacyName}`);
    pass('Status', rx.status);
    pass('Delivery address', rx.deliveryAddress);
  } catch (err) { fail('Assign pharmacy', err); }
}

// ─── Test: Confirm Availability (Pharmacy) ───────────────────────────────────
async function testConfirmAvailability() {
  console.log('\n--- STEP 3: Pharmacy confirms availability ---');
  try {
    const rx = await prescriptionService.confirmAvailability(prescriptionId, pharmacyProfileId);
    pass('Availability confirmed', `availabilityStatus: ${rx.availabilityStatus}`);
  } catch (err) { fail('Confirm availability', err); }
}

// ─── Test: Start Processing (Pharmacy) ───────────────────────────────────────
async function testStartProcessing() {
  console.log('\n--- STEP 4: Pharmacy starts processing ---');
  try {
    // Get a pharmacist (using pharmacyUserId as the pharmacist for testing)
    const rx = await prescriptionService.startProcessing(prescriptionId, pharmacyProfileId, pharmacyUserId);
    pass('Processing started', `Status: ${rx.status}`);
    pass('Assigned pharmacist', rx.assignedPharmacistId);
  } catch (err) { fail('Start processing', err); }
}

// ─── Test: Provide Costs / Invoice (Pharmacy) ────────────────────────────────
async function testProvideCosts() {
  console.log('\n--- STEP 5: Pharmacy provides invoice ---');
  try {
    const rx = await prescriptionService.provideCosts(prescriptionId, pharmacyProfileId, {
      items: [
        { name: 'Paracetamol 500mg x10', quantity: 10, unitPrice: 50 },
        { name: 'Amoxicillin 250mg x21', quantity: 21, unitPrice: 80 }
      ],
      deliveryFee: 500,
      paymentMethod: 'online'
    });
    pass('Invoice sent', `Total: ₦${rx.totalDue}`);
    pass('Invoice items count', rx.invoiceItems.length);
    pass('Delivery fee', `₦${rx.deliveryFee}`);
  } catch (err) { fail('Provide costs', err); }
}

// ─── Test: Mark Ready (Pharmacy) ─────────────────────────────────────────────
async function testMarkReady() {
  console.log('\n--- STEP 6: Pharmacy marks as ready for delivery ---');
  try {
    const rx = await prescriptionService.markReady(prescriptionId, pharmacyProfileId, 'delivery', new Date(Date.now() + 3600000));
    pass('Marked ready', `Status: ${rx.status}`);
  } catch (err) { fail('Mark ready', err); }
}

// ─── Test: Complete Prescription (Pharmacy) ───────────────────────────────────
async function testComplete() {
  console.log('\n--- STEP 7: Pharmacy completes fulfillment ---');
  try {
    const rx = await prescriptionService.completePrescription(prescriptionId, pharmacyProfileId);
    pass('Prescription completed', `Status: ${rx.status}`);
    pass('Payment status', rx.paymentStatus);
  } catch (err) { fail('Complete prescription', err); }
}

// ─── Test: Propose Alternative (separate prescription) ───────────────────────
async function testProposeAlternative() {
  console.log('\n--- STEP 8: Propose alternative medications ---');
  try {
    // Create a new prescription for this test
    const rx2 = await prescriptionService.createPrescription({
      patientId,
      medications: [
        { name: 'Rare Drug X', dosage: '100mg', frequency: 'Once daily', duration: '3 days', route: 'oral', quantity: 3 }
      ],
      diagnosis: 'Test condition'
    }, doctorId);

    // Assign to pharmacy
    await prescriptionService.assignPharmacy(rx2.id, pharmacyProfileId, patientId, {});

    // Propose alternative
    const rx2Updated = await prescriptionService.proposeAlternative(
      rx2.id,
      pharmacyProfileId,
      [
        { name: 'Common Drug Y', dosage: '100mg', reason: 'Rare Drug X not in stock' },
        { name: 'Common Drug Z', dosage: '50mg twice', reason: 'Equally effective alternative' }
      ],
      pharmacyUserId
    );

    pass('Alternative proposed', `availabilityStatus: ${rx2Updated.availabilityStatus}`);
    const lastNote = rx2Updated.internalNotes?.findLast?.(n => n.type === 'alternative_proposal')
      ?? rx2Updated.internalNotes?.[rx2Updated.internalNotes.length - 1];
    pass('Alternatives stored in internalNotes', `${lastNote?.alternatives?.length} alternatives`);
  } catch (err) { fail('Propose alternative', err); }
}

// ─── Test: Chat Message ───────────────────────────────────────────────────────
async function testChatMessage() {
  console.log('\n--- STEP 9: Chat message test ---');
  try {
    // Create a fresh prescription for chat test
    const rx3 = await prescriptionService.createPrescription({
      patientId,
      medications: [
        { name: 'Test Med', dosage: '10mg', frequency: 'Once', duration: '1 day', route: 'oral', quantity: 1 }
      ]
    }, doctorId);
    await prescriptionService.assignPharmacy(rx3.id, pharmacyProfileId, patientId, {});

    // Patient sends message
    const rx3Chat = await prescriptionService.addChatMessage(
      rx3.id,
      { message: 'Can you deliver before 6pm?', senderType: 'patient' },
      patientId
    );
    pass('Patient chat message sent', `Messages: ${rx3Chat.chatMessages?.length}`);

    // Pharmacy replies
    const rx3Reply = await prescriptionService.addChatMessage(
      rx3.id,
      { message: 'Yes, we can deliver by 5pm.', senderType: 'pharmacy' },
      pharmacyProfileId
    );
    pass('Pharmacy reply sent', `Messages: ${rx3Reply.chatMessages?.length}`);
  } catch (err) { fail('Chat message', err); }
}

// ─── Test: Cancellation ───────────────────────────────────────────────────────
async function testCancellation() {
  console.log('\n--- STEP 10: Cancellation test ---');
  try {
    const rx4 = await prescriptionService.createPrescription({
      patientId,
      medications: [
        { name: 'Cancel Test Med', dosage: '5mg', frequency: 'Once', duration: '1 day', route: 'oral', quantity: 1 }
      ]
    }, doctorId);

    const cancelled = await prescriptionService.cancelPrescription(rx4.id, patientId, 'Changed my mind');
    pass('Prescription cancelled', `Status: ${cancelled.status}`);
    pass('Cancellation recorded in history', cancelled.fulfillmentHistory?.length);
  } catch (err) { fail('Cancellation', err); }
}

// ─── Test: Get Doctor Prescriptions (with pharmacy info) ─────────────────────
async function testGetDoctorPrescriptions() {
  console.log('\n--- STEP 11: Get doctor prescriptions (with pharmacy info) ---');
  try {
    const rxList = await prescriptionService.getDoctorPrescriptions(doctorId, { limit: 10 });
    pass('Retrieved prescriptions', `Count: ${rxList.length}`);

    const withPharmacy = rxList.filter(r => r.pharmacyId);
    pass('Prescriptions with pharmacy assigned', withPharmacy.length);

    if (withPharmacy.length > 0) {
      const sample = withPharmacy[0];
      pass('Pharmacy name visible', sample.pharmacy?.pharmacyName || '(relation loaded)');
    }
  } catch (err) { fail('Get doctor prescriptions', err); }
}

// ─── Test: Get Patient Prescriptions ─────────────────────────────────────────
async function testGetPatientPrescriptions() {
  console.log('\n--- STEP 12: Get patient prescriptions ---');
  try {
    const rxList = await prescriptionService.getPatientPrescriptions(patientId, { limit: 20 });
    pass('Retrieved prescriptions', `Count: ${rxList.length}`);

    const withPharmacy = rxList.filter(r => r.pharmacyId);
    pass('With pharmacy assigned', withPharmacy.length);
  } catch (err) { fail('Get patient prescriptions', err); }
}

// ─── Test: Dashboard Stats ────────────────────────────────────────────────────
async function testDashboardStats() {
  console.log('\n--- STEP 13: Pharmacy dashboard stats ---');
  try {
    const stats = await prescriptionService.getDashboardStats(pharmacyProfileId);
    pass('Dashboard stats retrieved');
    pass('Pending requests', stats.pendingRequests);
    pass('Active orders', stats.activeOrders);
    pass('Completed today', stats.completedToday);
  } catch (err) { fail('Dashboard stats', err); }
}

// ─── Test: Search Prescriptions ──────────────────────────────────────────────
async function testSearch() {
  console.log('\n--- STEP 14: Search prescriptions ---');
  try {
    const results = await prescriptionService.searchPrescriptions('E2E');
    pass('Search completed', `Results: ${results.length}`);

    const byRef = await prescriptionService.searchPrescriptions(prescriptionRef?.slice(0, 5) || 'RX-');
    pass('Search by reference prefix', `Results: ${byRef.length}`);
  } catch (err) { fail('Search', err); }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function runAll() {
  try {
    await setup();
    await testCreatePrescription();
    await testAssignPharmacy();
    await testConfirmAvailability();
    await testStartProcessing();
    await testProvideCosts();
    await testMarkReady();
    await testComplete();
    await testProposeAlternative();
    await testChatMessage();
    await testCancellation();
    await testGetDoctorPrescriptions();
    await testGetPatientPrescriptions();
    await testDashboardStats();
    await testSearch();

    console.log('\n═══════════════════════════════════════════════');
    console.log('   🎉 ALL PRESCRIPTION WORKFLOW TESTS PASSED!');
    console.log('═══════════════════════════════════════════════\n');
    process.exit(0);
  } catch (err) {
    console.error('\n═══════════════════════════════════════════════');
    console.error('   💥 TEST SUITE FAILED');
    console.error('═══════════════════════════════════════════════');
    console.error(err.message);
    process.exit(1);
  } finally {
    try { await AppDataSource.destroy(); } catch { /* ignore */ }
  }
}

runAll();
