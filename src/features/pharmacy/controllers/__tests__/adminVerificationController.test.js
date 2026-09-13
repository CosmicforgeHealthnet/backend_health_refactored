/* eslint-env jest */
// Unit tests for AdminVerificationController — admin review of pharmacy
// license/ID documents. Each write endpoint maps pharmacyVerificationService
// error messages to an HTTP status via `error.message.includes(...)`
// checks; these tests verify that mapping against the service's actual
// thrown messages (cross-checked against pharmacyVerificationService.js)
// and that no message silently falls through to a 500 that should be a
// 4xx, or vice versa.

jest.mock('../../services/pharmacyVerificationService');
const pharmacyVerificationService = require('../../services/pharmacyVerificationService');

const controller = require('../adminVerificationController');

const ADMIN_ID        = 'aaaa0000-0000-0000-0000-000000000001';
const PHARMACY_ID     = 'bbbb0000-0000-0000-0000-000000000002';
const VERIFICATION_ID = 'cccc0000-0000-0000-0000-000000000003';
const DOCUMENT_ID     = 'dddd0000-0000-0000-0000-000000000004';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// getPendingVerifications — read-only, shapes the response
// ============================================================================

describe('getPendingVerifications', () => {
  test('maps verification requests to the trimmed response shape', async () => {
    pharmacyVerificationService.getPendingVerifications = jest.fn().mockResolvedValue([
      {
        id: VERIFICATION_ID, pharmacyId: PHARMACY_ID,
        pharmacy: { pharmacyName: 'Acme Pharmacy', registrationNumber: 'REG-1' },
        requestType: 'initial', status: 'pending', priority: 'normal',
        submittedAt: '2026-01-01T00:00:00Z', assignedTo: null,
      },
    ]);
    const req = {};
    const res = makeRes();
    const next = jest.fn();

    await controller.getPendingVerifications(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      verifications: [expect.objectContaining({
        id: VERIFICATION_ID, pharmacyName: 'Acme Pharmacy', registrationNumber: 'REG-1',
      })],
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('passes service errors to next()', async () => {
    pharmacyVerificationService.getPendingVerifications = jest.fn().mockRejectedValue(new Error('DB unreachable'));
    const req = {};
    const res = makeRes();
    const next = jest.fn();

    await controller.getPendingVerifications(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ============================================================================
// assignVerification
// ============================================================================

describe('assignVerification', () => {
  test('defaults to the current admin when no adminId is provided in the body', async () => {
    pharmacyVerificationService.assignVerificationToAdmin = jest.fn().mockResolvedValue(undefined);
    const req = { params: { verificationId: VERIFICATION_ID }, body: {}, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.assignVerification(req, res, next);

    expect(pharmacyVerificationService.assignVerificationToAdmin).toHaveBeenCalledWith(VERIFICATION_ID, ADMIN_ID);
    expect(res.json).toHaveBeenCalledWith({ message: 'Verification assigned successfully' });
  });

  test('uses an explicitly provided adminId over the current admin', async () => {
    pharmacyVerificationService.assignVerificationToAdmin = jest.fn().mockResolvedValue(undefined);
    const otherAdmin = 'eeee0000-0000-0000-0000-000000000005';
    const req = { params: { verificationId: VERIFICATION_ID }, body: { adminId: otherAdmin }, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.assignVerification(req, res, next);

    expect(pharmacyVerificationService.assignVerificationToAdmin).toHaveBeenCalledWith(VERIFICATION_ID, otherAdmin);
  });

  test('"Verification request not found" maps to 400', async () => {
    pharmacyVerificationService.assignVerificationToAdmin = jest.fn().mockRejectedValue(new Error('Verification request not found'));
    const req = { params: { verificationId: VERIFICATION_ID }, body: {}, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.assignVerification(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Verification request not found' });
  });

  test('"Verification request is not pending" maps to 400', async () => {
    pharmacyVerificationService.assignVerificationToAdmin = jest.fn().mockRejectedValue(new Error('Verification request is not pending'));
    const req = { params: { verificationId: VERIFICATION_ID }, body: {}, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.assignVerification(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('an unrelated error goes to next(), not a swallowed 400', async () => {
    pharmacyVerificationService.assignVerificationToAdmin = jest.fn().mockRejectedValue(new Error('connection reset'));
    const req = { params: { verificationId: VERIFICATION_ID }, body: {}, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.assignVerification(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'connection reset' }));
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ============================================================================
// reviewPharmacy
// ============================================================================

describe('reviewPharmacy', () => {
  test('shapes the documents array in the response', async () => {
    pharmacyVerificationService.reviewPharmacyDocuments = jest.fn().mockResolvedValue({
      pharmacy: { id: PHARMACY_ID },
      documents: [{ id: DOCUMENT_ID, documentType: 'license', documentName: 'license.pdf', isVerified: false, verificationNotes: null, submissionStatus: 'pending', documentFile: 'file-1' }],
    });
    const req = { params: { pharmacyId: PHARMACY_ID }, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.reviewPharmacy(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      pharmacy: { id: PHARMACY_ID },
      documents: [expect.objectContaining({ id: DOCUMENT_ID, documentType: 'license' })],
    });
  });

  test('"Pharmacy not found" maps to 404', async () => {
    pharmacyVerificationService.reviewPharmacyDocuments = jest.fn().mockRejectedValue(new Error('Pharmacy not found'));
    const req = { params: { pharmacyId: PHARMACY_ID }, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.reviewPharmacy(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ============================================================================
// verifyDocument
// ============================================================================

describe('verifyDocument', () => {
  test('passes isVerified and notes through to the service', async () => {
    pharmacyVerificationService.verifyDocument = jest.fn().mockResolvedValue(undefined);
    const req = { params: { documentId: DOCUMENT_ID }, body: { isVerified: true, notes: 'Looks good' }, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.verifyDocument(req, res, next);

    expect(pharmacyVerificationService.verifyDocument).toHaveBeenCalledWith(DOCUMENT_ID, ADMIN_ID, true, 'Looks good');
    expect(res.json).toHaveBeenCalledWith({ message: 'Document verification updated successfully' });
  });

  test('"Document not found" maps to 404', async () => {
    pharmacyVerificationService.verifyDocument = jest.fn().mockRejectedValue(new Error('Document not found'));
    const req = { params: { documentId: DOCUMENT_ID }, body: {}, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.verifyDocument(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ============================================================================
// approvePharmacy
// ============================================================================

describe('approvePharmacy', () => {
  test('succeeds and returns the service result verbatim', async () => {
    pharmacyVerificationService.approvePharmacy = jest.fn().mockResolvedValue({ success: true, message: 'Pharmacy approved successfully' });
    const req = { params: { pharmacyId: PHARMACY_ID }, body: { reviewNotes: 'All good' }, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.approvePharmacy(req, res, next);

    expect(pharmacyVerificationService.approvePharmacy).toHaveBeenCalledWith(PHARMACY_ID, ADMIN_ID, 'All good');
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Pharmacy approved successfully' });
  });

  test('"Cannot approve — no documents have been submitted..." maps to 400 (matches "no documents")', async () => {
    pharmacyVerificationService.approvePharmacy = jest.fn().mockRejectedValue(
      new Error('Cannot approve — no documents have been submitted, so none must be verified')
    );
    const req = { params: { pharmacyId: PHARMACY_ID }, body: {}, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.approvePharmacy(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('"All documents must be verified before approval" maps to 400 (matches "must be verified")', async () => {
    pharmacyVerificationService.approvePharmacy = jest.fn().mockRejectedValue(new Error('All documents must be verified before approval'));
    const req = { params: { pharmacyId: PHARMACY_ID }, body: {}, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.approvePharmacy(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('"Pharmacy not found" also maps to 400 here (approvePharmacy uses 400, not 404, for not-found)', async () => {
    pharmacyVerificationService.approvePharmacy = jest.fn().mockRejectedValue(new Error('Pharmacy not found'));
    const req = { params: { pharmacyId: PHARMACY_ID }, body: {}, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.approvePharmacy(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ============================================================================
// rejectPharmacy
// ============================================================================

describe('rejectPharmacy', () => {
  test('requires a rejectionReason before calling the service at all', async () => {
    const req = { params: { pharmacyId: PHARMACY_ID }, body: {}, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.rejectPharmacy(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Rejection reason is required' });
    expect(pharmacyVerificationService.rejectPharmacy).not.toHaveBeenCalled();
  });

  test('succeeds when a rejectionReason is provided', async () => {
    pharmacyVerificationService.rejectPharmacy = jest.fn().mockResolvedValue({ success: true, message: 'Pharmacy rejected' });
    const req = { params: { pharmacyId: PHARMACY_ID }, body: { rejectionReason: 'Expired license' }, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.rejectPharmacy(req, res, next);

    expect(pharmacyVerificationService.rejectPharmacy).toHaveBeenCalledWith(PHARMACY_ID, ADMIN_ID, 'Expired license');
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Pharmacy rejected' });
  });
});

// ============================================================================
// requestMoreDocuments
// ============================================================================

describe('requestMoreDocuments', () => {
  test('requires requiredDocuments to be an array', async () => {
    const req = { params: { pharmacyId: PHARMACY_ID }, body: { requiredDocuments: 'license' }, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.requestMoreDocuments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(pharmacyVerificationService.requestMoreDocuments).not.toHaveBeenCalled();
  });

  test('rejects a missing requiredDocuments field', async () => {
    const req = { params: { pharmacyId: PHARMACY_ID }, body: {}, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.requestMoreDocuments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Required documents list is needed' });
  });

  test('succeeds with a valid array', async () => {
    pharmacyVerificationService.requestMoreDocuments = jest.fn().mockResolvedValue({ success: true, message: 'Additional documents requested' });
    const req = { params: { pharmacyId: PHARMACY_ID }, body: { requiredDocuments: ['license', 'id'] }, user: { sub: ADMIN_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.requestMoreDocuments(req, res, next);

    expect(pharmacyVerificationService.requestMoreDocuments).toHaveBeenCalledWith(PHARMACY_ID, ADMIN_ID, ['license', 'id']);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Additional documents requested' });
  });
});
