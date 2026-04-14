/* eslint-env jest */
// Unit tests for DisputeService.createRefundRequest
// Tests the dispute creation logic, focusing on the 400 bug and status validation

jest.mock('../../repositories/disputeRepository');
jest.mock('../../repositories/transactionRepository');
jest.mock('../../repositories/transactionSplitRepository');
jest.mock('../../../payments/repositories/doctorWalletRepository');
jest.mock('../paymentService');

const disputeRepository = require('../../repositories/disputeRepository');
const transactionRepository = require('../../repositories/transactionRepository');

// disputeService exports a singleton instance
const disputeService = require('../disputeService');

// ─── Helpers ────────────────────────────────────────────────────────────────

const PATIENT_ID = 'aaaa0000-0000-0000-0000-000000000001';
const DOCTOR_ID  = 'bbbb0000-0000-0000-0000-000000000002';
const TX_ID      = 'cccc0000-0000-0000-0000-000000000003';
const DISPUTE_ID = 'dddd0000-0000-0000-0000-000000000004';

const futureWindow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
const pastWindow   = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

function makeTransaction(overrides = {}) {
  return {
    id: TX_ID,
    patientId: PATIENT_ID,
    doctorId: DOCTOR_ID,
    status: 'completed',
    completedAt: new Date('2026-04-11T01:24:00.000Z'),
    disputeWindowEndsAt: futureWindow,
    fundsStatus: 'pending_appointment',
    ...overrides,
  };
}

function makeDisputeData(overrides = {}) {
  return {
    transactionId: TX_ID,
    userId: PATIENT_ID,
    userRole: 'patient',
    reason: 'poor_quality',
    description: 'Service was not provided as expected.',
    ...overrides,
  };
}

function makeSavedDispute() {
  return {
    id: DISPUTE_ID,
    transactionId: TX_ID,
    patientId: PATIENT_ID,
    doctorId: DOCTOR_ID,
    status: 'pending',
    reason: 'poor_quality',
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  disputeRepository.findByTransactionId = jest.fn().mockResolvedValue([]);
  disputeRepository.create = jest.fn().mockReturnValue(makeSavedDispute());
  disputeRepository.save   = jest.fn().mockResolvedValue(makeSavedDispute());
  transactionRepository.updateStatus = jest.fn().mockResolvedValue(undefined);
});

// ============================================================================
// SUITE 1 - Happy-path: Patient creates a dispute
// ============================================================================

describe('createRefundRequest - patient happy path', () => {
  test('should create a dispute for a completed transaction', async () => {
    transactionRepository.findById = jest.fn().mockResolvedValue(makeTransaction());

    const result = await disputeService.createRefundRequest(makeDisputeData());

    expect(transactionRepository.findById).toHaveBeenCalledWith(TX_ID);
    expect(disputeRepository.findByTransactionId).toHaveBeenCalledWith(TX_ID);
    expect(disputeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: TX_ID,
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        type: 'refund_request',
        reason: 'poor_quality',
        status: 'pending',
      })
    );
    expect(transactionRepository.updateStatus).toHaveBeenCalledWith(TX_ID, 'disputed');
    expect(result).toMatchObject({ id: DISPUTE_ID, status: 'pending' });
  });

  test('should create a dispute for a processing transaction (webhook not yet confirmed)', async () => {
    transactionRepository.findById = jest.fn().mockResolvedValue(
      makeTransaction({ status: 'processing', completedAt: null })
    );

    await expect(disputeService.createRefundRequest(makeDisputeData())).resolves.toBeDefined();
    expect(transactionRepository.updateStatus).toHaveBeenCalledWith(TX_ID, 'disputed');
  });

  test('should create a dispute when status is pending but completedAt is set (status-lag fix)', async () => {
    // Regression test for the bug: webhook set completedAt but status update was delayed
    transactionRepository.findById = jest.fn().mockResolvedValue(
      makeTransaction({ status: 'pending', completedAt: new Date('2026-04-11T01:24:00.000Z') })
    );

    await expect(disputeService.createRefundRequest(makeDisputeData())).resolves.toBeDefined();
    expect(transactionRepository.updateStatus).toHaveBeenCalledWith(TX_ID, 'disputed');
  });
});

// ============================================================================
// SUITE 2 - Doctor creating dispute (the bug-report scenario)
// ============================================================================

describe('createRefundRequest - doctor creating dispute (bug-report scenario)', () => {
  test('doctor can dispute a completed appointment transaction', async () => {
    transactionRepository.findById = jest.fn().mockResolvedValue(makeTransaction());

    const result = await disputeService.createRefundRequest(
      makeDisputeData({ userId: DOCTOR_ID, userRole: 'doctor' })
    );

    expect(result).toMatchObject({ id: DISPUTE_ID });
  });

  test('doctor can dispute a transaction with fundsStatus pending_appointment and status completed', async () => {
    transactionRepository.findById = jest.fn().mockResolvedValue(
      makeTransaction({
        status: 'completed',
        fundsStatus: 'pending_appointment',
        completedAt: new Date('2026-04-11T01:24:00.000Z'),
        disputeWindowEndsAt: futureWindow,
      })
    );

    await expect(
      disputeService.createRefundRequest(makeDisputeData({ userId: DOCTOR_ID, userRole: 'doctor' }))
    ).resolves.toBeDefined();
  });
});

// ============================================================================
// SUITE 3 - Blocked statuses (no money moved)
// ============================================================================

describe('createRefundRequest - status blocks', () => {
  const blockedCases = [
    { status: 'pending',  completedAt: null,         label: 'pending with no completedAt (never paid)' },
    { status: 'failed',   completedAt: null,         label: 'failed payment' },
    { status: 'disputed', completedAt: new Date(),   label: 'already disputed' },
    { status: 'refunded', completedAt: new Date(),   label: 'already refunded' },
  ];

  blockedCases.forEach(function(tc) {
    test('should throw for ' + tc.label, async () => {
      transactionRepository.findById = jest.fn().mockResolvedValue(
        makeTransaction({ status: tc.status, completedAt: tc.completedAt })
      );

      await expect(
        disputeService.createRefundRequest(makeDisputeData())
      ).rejects.toThrow('Can only dispute completed transactions');
    });
  });
});

// ============================================================================
// SUITE 4 - Authorization checks
// ============================================================================

describe('createRefundRequest - authorization', () => {
  test('should throw when transaction not found', async () => {
    transactionRepository.findById = jest.fn().mockResolvedValue(null);

    await expect(disputeService.createRefundRequest(makeDisputeData())).rejects.toThrow(
      'Transaction not found'
    );
  });

  test('should throw Unauthorized when user is unrelated to transaction', async () => {
    const STRANGER_ID = 'ffff0000-0000-0000-0000-000000000099';
    transactionRepository.findById = jest.fn().mockResolvedValue(makeTransaction());

    await expect(
      disputeService.createRefundRequest(makeDisputeData({ userId: STRANGER_ID, userRole: 'patient' }))
    ).rejects.toThrow('Unauthorized to dispute this transaction');
  });

  test('should throw Unauthorized when doctor disputes a transaction they are not part of', async () => {
    const OTHER_DOCTOR = 'bbbb0000-0000-0000-0000-000000000099';
    transactionRepository.findById = jest.fn().mockResolvedValue(makeTransaction());

    await expect(
      disputeService.createRefundRequest(makeDisputeData({ userId: OTHER_DOCTOR, userRole: 'doctor' }))
    ).rejects.toThrow('Unauthorized to dispute this transaction');
  });
});

// ============================================================================
// SUITE 5 - Dispute window and duplicate guards
// ============================================================================

describe('createRefundRequest - business rule guards', () => {
  test('should throw when dispute window has expired', async () => {
    transactionRepository.findById = jest.fn().mockResolvedValue(
      makeTransaction({ disputeWindowEndsAt: pastWindow })
    );

    await expect(disputeService.createRefundRequest(makeDisputeData())).rejects.toThrow(
      'Dispute window has expired'
    );
  });

  test('should allow dispute when disputeWindowEndsAt is null (window always open)', async () => {
    transactionRepository.findById = jest.fn().mockResolvedValue(
      makeTransaction({ disputeWindowEndsAt: null })
    );

    await expect(disputeService.createRefundRequest(makeDisputeData())).resolves.toBeDefined();
  });

  test('should throw when a dispute already exists for the transaction', async () => {
    transactionRepository.findById = jest.fn().mockResolvedValue(makeTransaction());
    disputeRepository.findByTransactionId = jest.fn().mockResolvedValue([makeSavedDispute()]);

    await expect(disputeService.createRefundRequest(makeDisputeData())).rejects.toThrow(
      'Dispute already exists for this transaction'
    );
  });

  test('should NOT call create or updateStatus when a duplicate dispute is detected', async () => {
    transactionRepository.findById = jest.fn().mockResolvedValue(makeTransaction());
    disputeRepository.findByTransactionId = jest.fn().mockResolvedValue([makeSavedDispute()]);

    await expect(disputeService.createRefundRequest(makeDisputeData())).rejects.toThrow();
    expect(disputeRepository.create).not.toHaveBeenCalled();
    expect(transactionRepository.updateStatus).not.toHaveBeenCalled();
  });
});
