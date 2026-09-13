/* eslint-env jest */
// Light-pass unit tests for PharmacyDocumentController — document upload/
// list/delete for pharmacy license verification. Thin delegation to
// pharmacyRegistrationService / pharmacyDocumentRepository, but the ownership
// check in deleteDocument (doc.pharmacyId !== pharmacy.id) is real inline
// logic worth verifying directly.

jest.mock('../../services/pharmacyRegistrationService');
jest.mock('../../repositories/pharmacyDocumentRepository');

const pharmacyRegistrationService = require('../../services/pharmacyRegistrationService');
const pharmacyDocumentRepo        = require('../../repositories/pharmacyDocumentRepository');

const controller = require('../pharmacyDocumentController');

const USER_ID     = 'aaaa0000-0000-0000-0000-000000000001';
const PHARMACY_ID = 'bbbb0000-0000-0000-0000-000000000002';
const DOC_ID      = 'cccc0000-0000-0000-0000-000000000003';

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  pharmacyRegistrationService.getPharmacyProfile = jest.fn().mockResolvedValue({ id: PHARMACY_ID, documents: [] });
});

describe('uploadDocuments', () => {
  test('404s when there is no pharmacy profile', async () => {
    pharmacyRegistrationService.getPharmacyProfile = jest.fn().mockResolvedValue(null);
    const req = { user: { sub: USER_ID }, savedFiles: [{ id: 'f1' }], body: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.uploadDocuments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('400s when no files were saved by upload middleware', async () => {
    const req = { user: { sub: USER_ID }, savedFiles: [], body: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.uploadDocuments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No documents uploaded' });
  });

  test('maps saved files to documentsData using body indices, defaulting type to "other"', async () => {
    pharmacyRegistrationService.uploadPharmacyDocuments = jest.fn().mockResolvedValue([
      { id: 'doc-1', documentType: 'license', documentName: 'license.pdf', submissionStatus: 'pending' },
    ]);
    const req = {
      user: { sub: USER_ID },
      savedFiles: [{ id: 'file-1', originalFileName: 'license.pdf' }],
      body: { documentType_0: 'license', documentName_0: 'My License' },
    };
    const res = makeRes();
    const next = jest.fn();

    await controller.uploadDocuments(req, res, next);

    expect(pharmacyRegistrationService.uploadPharmacyDocuments).toHaveBeenCalledWith(PHARMACY_ID, [
      { fileId: 'file-1', documentType: 'license', documentName: 'My License' },
    ]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Documents uploaded successfully',
      pharmacy: { verificationStatus: 'under_review' },
    }));
  });

  test('defaults documentType to "other" and documentName to the original filename when not provided', async () => {
    pharmacyRegistrationService.uploadPharmacyDocuments = jest.fn().mockResolvedValue([]);
    const req = {
      user: { sub: USER_ID },
      savedFiles: [{ id: 'file-1', originalFileName: 'scan.pdf' }],
      body: {},
    };
    const res = makeRes();
    const next = jest.fn();

    await controller.uploadDocuments(req, res, next);

    expect(pharmacyRegistrationService.uploadPharmacyDocuments).toHaveBeenCalledWith(PHARMACY_ID, [
      { fileId: 'file-1', documentType: 'other', documentName: 'scan.pdf' },
    ]);
  });

  test('forwards a service error to next()', async () => {
    pharmacyRegistrationService.uploadPharmacyDocuments = jest.fn().mockRejectedValue(new Error('storage full'));
    const req = { user: { sub: USER_ID }, savedFiles: [{ id: 'f1', originalFileName: 'x.pdf' }], body: {} };
    const res = makeRes();
    const next = jest.fn();

    await controller.uploadDocuments(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('getDocuments', () => {
  test('404s when there is no pharmacy profile', async () => {
    pharmacyRegistrationService.getPharmacyProfile = jest.fn().mockResolvedValue(null);
    const req = { user: { sub: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.getDocuments(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns the documents array, defaulting to [] when absent', async () => {
    pharmacyRegistrationService.getPharmacyProfile = jest.fn().mockResolvedValue({ id: PHARMACY_ID });
    const req = { user: { sub: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.getDocuments(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ documents: [] });
  });

  test('returns the existing documents when present', async () => {
    const docs = [{ id: DOC_ID, documentType: 'license' }];
    pharmacyRegistrationService.getPharmacyProfile = jest.fn().mockResolvedValue({ id: PHARMACY_ID, documents: docs });
    const req = { user: { sub: USER_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.getDocuments(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ documents: docs });
  });
});

describe('deleteDocument', () => {
  test('404s when there is no pharmacy profile', async () => {
    pharmacyRegistrationService.getPharmacyProfile = jest.fn().mockResolvedValue(null);
    const req = { user: { sub: USER_ID }, params: { id: DOC_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.deleteDocument(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(pharmacyDocumentRepo.deleteById).not.toHaveBeenCalled();
  });

  test('404s when the document does not exist', async () => {
    pharmacyDocumentRepo.findById = jest.fn().mockResolvedValue(null);
    const req = { user: { sub: USER_ID }, params: { id: DOC_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.deleteDocument(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Document not found' });
  });

  test('404s (not 403) when the document belongs to a different pharmacy — does not leak existence', async () => {
    pharmacyDocumentRepo.findById = jest.fn().mockResolvedValue({ id: DOC_ID, pharmacyId: 'someone-elses-pharmacy' });
    const req = { user: { sub: USER_ID }, params: { id: DOC_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.deleteDocument(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(pharmacyDocumentRepo.deleteById).not.toHaveBeenCalled();
  });

  test('deletes the document when it belongs to the caller\'s pharmacy', async () => {
    pharmacyDocumentRepo.findById = jest.fn().mockResolvedValue({ id: DOC_ID, pharmacyId: PHARMACY_ID });
    pharmacyDocumentRepo.deleteById = jest.fn().mockResolvedValue(undefined);
    const req = { user: { sub: USER_ID }, params: { id: DOC_ID } };
    const res = makeRes();
    const next = jest.fn();

    await controller.deleteDocument(req, res, next);

    expect(pharmacyDocumentRepo.deleteById).toHaveBeenCalledWith(DOC_ID);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Document deleted' });
  });
});
