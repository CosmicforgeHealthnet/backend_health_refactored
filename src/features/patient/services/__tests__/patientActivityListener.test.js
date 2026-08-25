/* eslint-env jest */
// Unit tests for PatientActivityListener — the fire-and-forget bridge between
// patient profile/document mutations and the AI service. Both public entry
// points (onPatientProfileUpdated, onDocumentUploaded) kick off a background
// task without awaiting it, specifically so that a slow or failing AI call
// never blocks or breaks the request that triggered it. These tests assert:
//   - the right repository writes happen for a successful AI response,
//   - a null/partial AI response or a rejected AI call is swallowed and never
//     escapes as an unhandled rejection or a thrown error out of the public
//     methods.

jest.mock('../aiIntegrationService');
jest.mock('../../repositories/patientRiskAssessmentRepository');
jest.mock('../../../documents/repositories/documentFileRepository');

const aiIntegrationService = require('../aiIntegrationService');
const patientRiskAssessmentRepository = require('../../repositories/patientRiskAssessmentRepository');
const documentFileRepository = require('../../../documents/repositories/documentFileRepository');

const patientActivityListener = require('../patientActivityListener');

const PATIENT_ID = 'pppp0000-0000-0000-0000-000000000001';

// Flushes the microtask queue so a fire-and-forget promise chain
// (`.catch(...)` attached but not awaited by the caller) gets a chance to
// settle before assertions run.
const flush = () => new Promise((resolve) => setImmediate(resolve));

function makeFullAnalysis(overrides = {}) {
    return {
        results: {
            cardiovascular: { score: 12, risk_level: 'low', vectors: ['age'], model: 'cvd-v1' },
            diabetes: { score: 8, risk_level: 'low', vectors: ['bmi'], model: 'diabetes-v1' },
        },
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    aiIntegrationService.calculatePatientRisks = jest.fn().mockResolvedValue(makeFullAnalysis());
    aiIntegrationService.processMedicalDocument = jest.fn().mockResolvedValue(null);
    patientRiskAssessmentRepository.saveAssessment = jest.fn().mockResolvedValue(undefined);
    documentFileRepository.getFileById = jest.fn().mockResolvedValue(null);
    documentFileRepository.updateFile = jest.fn().mockResolvedValue(undefined);
});

afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
});

// ============================================================================
// onPatientProfileUpdated -> _runRiskAnalysis
// ============================================================================

describe('onPatientProfileUpdated', () => {
    test('saves both a CVD and a Diabetes risk assessment from a full AI response', async () => {
        const profile = { id: PATIENT_ID, bmi: 24 };

        await patientActivityListener.onPatientProfileUpdated(PATIENT_ID, profile);
        await flush();

        expect(aiIntegrationService.calculatePatientRisks).toHaveBeenCalledWith(profile);
        expect(patientRiskAssessmentRepository.saveAssessment).toHaveBeenCalledTimes(2);
        expect(patientRiskAssessmentRepository.saveAssessment).toHaveBeenCalledWith({
            patient: { id: PATIENT_ID },
            assessmentType: 'CVD',
            riskScore: 12,
            riskLevel: 'low',
            contributingFactors: ['age'],
            aiModelVersion: 'cvd-v1',
        });
        expect(patientRiskAssessmentRepository.saveAssessment).toHaveBeenCalledWith({
            patient: { id: PATIENT_ID },
            assessmentType: 'DIABETES',
            riskScore: 8,
            riskLevel: 'low',
            contributingFactors: ['bmi'],
            aiModelVersion: 'diabetes-v1',
        });
    });

    test('does not save anything when the AI service returns null (down/unreachable)', async () => {
        aiIntegrationService.calculatePatientRisks = jest.fn().mockResolvedValue(null);

        await patientActivityListener.onPatientProfileUpdated(PATIENT_ID, {});
        await flush();

        expect(patientRiskAssessmentRepository.saveAssessment).not.toHaveBeenCalled();
    });

    test('does not save anything when the AI response has no results', async () => {
        aiIntegrationService.calculatePatientRisks = jest.fn().mockResolvedValue({ results: null });

        await patientActivityListener.onPatientProfileUpdated(PATIENT_ID, {});
        await flush();

        expect(patientRiskAssessmentRepository.saveAssessment).not.toHaveBeenCalled();
    });

    test('a malformed AI response (missing diabetes block) is caught in the background and does not throw out of the caller', async () => {
        aiIntegrationService.calculatePatientRisks = jest.fn().mockResolvedValue({
            results: { cardiovascular: { score: 1, risk_level: 'low', vectors: [], model: 'v1' } },
            // diabetes missing entirely -> accessing .score on it throws inside _runRiskAnalysis
        });

        await expect(patientActivityListener.onPatientProfileUpdated(PATIENT_ID, {})).resolves.toBeUndefined();
        await flush();

        // The CVD save was attempted before the failure on the diabetes block.
        expect(patientRiskAssessmentRepository.saveAssessment).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith('Background AI Risk Task Failed:', expect.any(Error));
    });

    test('a rejected AI call is caught in the background and does not throw out of the caller', async () => {
        aiIntegrationService.calculatePatientRisks = jest.fn().mockRejectedValue(new Error('AI service down'));

        await expect(patientActivityListener.onPatientProfileUpdated(PATIENT_ID, {})).resolves.toBeUndefined();
        await flush();

        expect(patientRiskAssessmentRepository.saveAssessment).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith('Background AI Risk Task Failed:', expect.any(Error));
    });

    test('a repository failure while saving an assessment is caught in the background', async () => {
        patientRiskAssessmentRepository.saveAssessment = jest.fn().mockRejectedValue(new Error('DB unavailable'));

        await expect(patientActivityListener.onPatientProfileUpdated(PATIENT_ID, {})).resolves.toBeUndefined();
        await flush();

        expect(console.error).toHaveBeenCalledWith('Background AI Risk Task Failed:', expect.any(Error));
    });
});

// ============================================================================
// onDocumentUploaded -> _processDocument
// ============================================================================

describe('onDocumentUploaded', () => {
    test('does nothing when the file has neither a buffer nor a filePath', async () => {
        const file = { id: 'file-1' };

        await patientActivityListener.onDocumentUploaded(PATIENT_ID, file);
        await flush();

        expect(aiIntegrationService.processMedicalDocument).not.toHaveBeenCalled();
    });

    test('does nothing when only filePath is given (buffer resolution from disk is not implemented)', async () => {
        // NOTE: _processDocument's filePath branch is a documented no-op today
        // (the try block that would read the file back into a buffer is
        // empty) - a file uploaded by path alone silently never reaches the
        // AI service. Pinning down current behavior rather than "fixing" an
        // incomplete feature with no spec for how path resolution should work.
        const file = { id: 'file-1', filePath: '/uploads/doc.pdf' };

        await patientActivityListener.onDocumentUploaded(PATIENT_ID, file);
        await flush();

        expect(aiIntegrationService.processMedicalDocument).not.toHaveBeenCalled();
    });

    test('sends the buffer to the AI service and returns quietly when it responds with no entities', async () => {
        const file = { buffer: Buffer.from('pdf-bytes'), originalFileName: 'scan.pdf' };
        aiIntegrationService.processMedicalDocument = jest.fn().mockResolvedValue(null);

        await patientActivityListener.onDocumentUploaded(PATIENT_ID, file);
        await flush();

        expect(aiIntegrationService.processMedicalDocument).toHaveBeenCalledWith(file.buffer, 'scan.pdf');
        expect(documentFileRepository.updateFile).not.toHaveBeenCalled();
    });

    test('defaults the filename to doc.pdf when originalFileName is missing', async () => {
        const file = { buffer: Buffer.from('pdf-bytes') };

        await patientActivityListener.onDocumentUploaded(PATIENT_ID, file);
        await flush();

        expect(aiIntegrationService.processMedicalDocument).toHaveBeenCalledWith(file.buffer, 'doc.pdf');
    });

    test('merges AI-extracted entities into the file metadata and saves it, when file/uploader ids are present', async () => {
        const file = {
            id: 'file-1',
            buffer: Buffer.from('pdf-bytes'),
            originalFileName: 'scan.pdf',
            uploader: { id: 'uploader-1' },
        };
        aiIntegrationService.processMedicalDocument = jest.fn().mockResolvedValue({
            entities: { diagnosis: 'Flu' },
        });
        documentFileRepository.getFileById = jest.fn().mockResolvedValue({
            id: 'file-1',
            metadata: { existing: true },
        });

        await patientActivityListener.onDocumentUploaded(PATIENT_ID, file);
        await flush();

        expect(documentFileRepository.getFileById).toHaveBeenCalledWith('file-1', 'uploader-1');
        expect(documentFileRepository.updateFile).toHaveBeenCalledWith('file-1', 'uploader-1', {
            metadata: expect.objectContaining({
                existing: true,
                ai_extraction: { diagnosis: 'Flu' },
                ai_extracted_at: expect.any(String),
            }),
        });
    });

    test('does not update metadata when file.id or uploader.id is missing', async () => {
        const file = { buffer: Buffer.from('pdf-bytes'), id: 'file-1' }; // no uploader
        aiIntegrationService.processMedicalDocument = jest.fn().mockResolvedValue({ entities: { x: 1 } });

        await patientActivityListener.onDocumentUploaded(PATIENT_ID, file);
        await flush();

        expect(documentFileRepository.getFileById).not.toHaveBeenCalled();
        expect(documentFileRepository.updateFile).not.toHaveBeenCalled();
    });

    test('does not update metadata when the file record can no longer be found', async () => {
        const file = {
            id: 'file-1',
            buffer: Buffer.from('pdf-bytes'),
            uploader: { id: 'uploader-1' },
        };
        aiIntegrationService.processMedicalDocument = jest.fn().mockResolvedValue({ entities: { x: 1 } });
        documentFileRepository.getFileById = jest.fn().mockResolvedValue(null);

        await patientActivityListener.onDocumentUploaded(PATIENT_ID, file);
        await flush();

        expect(documentFileRepository.updateFile).not.toHaveBeenCalled();
    });

    test('a rejected AI call is caught in the background and does not throw out of the caller', async () => {
        const file = { buffer: Buffer.from('pdf-bytes') };
        aiIntegrationService.processMedicalDocument = jest.fn().mockRejectedValue(new Error('AI service down'));

        await expect(patientActivityListener.onDocumentUploaded(PATIENT_ID, file)).resolves.toBeUndefined();
        await flush();

        expect(console.error).toHaveBeenCalledWith('Background AI Doc Task Failed:', expect.any(Error));
    });
});
