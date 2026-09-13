/* eslint-env jest */
// Unit tests for AiIntegrationService — the boundary between this backend and
// the external AI microservice (FHIR intake standardization, cardiovascular
// /diabetes risk scoring, document OCR/entity extraction).
//
// The service is a thin axios wrapper: every method posts a shaped payload
// and, on any failure, swallows the error and returns null so a flaky/down
// AI service never breaks the main patient-facing flow. These tests mock the
// axios client boundary only — the request shaping and error-swallowing
// behavior is what's under test, not the AI's own logic.

jest.mock('axios');

const axios = require('axios');

const mockPost = jest.fn();
axios.create = jest.fn(() => ({ post: mockPost }));

// Constructed once at require time (module.exports = new AiIntegrationService()),
// so axios.create must already be wired above before this require runs.
const aiIntegrationService = require('../aiIntegrationService');

const PATIENT_ID = 'pppp0000-0000-0000-0000-000000000001';

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    console.error.mockRestore();
});

describe('processIntakeForm', () => {
    test('posts the patientId and formData, and returns the AI response payload', async () => {
        mockPost.mockResolvedValue({ data: { standardized: true } });
        const formData = { symptoms: ['cough'] };

        const result = await aiIntegrationService.processIntakeForm(PATIENT_ID, formData);

        expect(mockPost).toHaveBeenCalledWith('/ingest/intake', { patientId: PATIENT_ID, formData });
        expect(result).toEqual({ standardized: true });
    });

    test('returns null (does not throw) when the AI service call fails', async () => {
        mockPost.mockRejectedValue(new Error('AI service unreachable'));

        const result = await aiIntegrationService.processIntakeForm(PATIENT_ID, {});

        expect(result).toBeNull();
    });
});

describe('calculatePatientRisks', () => {
    test('maps a full patient profile to the AI service payload shape', async () => {
        mockPost.mockResolvedValue({ data: { results: {} } });
        const profile = {
            id: PATIENT_ID,
            dateOfBirth: new Date(Date.now() - 30 * 365.25 * 24 * 60 * 60 * 1000).toISOString(),
            gender: 'male',
            bloodPressure: '150/95',
            bmi: 27.5,
            smokes: true,
        };

        await aiIntegrationService.calculatePatientRisks(profile);

        expect(mockPost).toHaveBeenCalledWith('/predict/calculate', {
            patientId: PATIENT_ID,
            age: 30,
            gender: 'male',
            systolic_bp: 150,
            bmi: 27.5,
            smoker: true,
            family_diabetes: false,
        });
    });

    test('applies defaults for a minimal profile: age 30, bp 120, bmi 22.0, smoker false', async () => {
        mockPost.mockResolvedValue({ data: { results: {} } });

        await aiIntegrationService.calculatePatientRisks({ id: PATIENT_ID });

        expect(mockPost).toHaveBeenCalledWith('/predict/calculate', {
            patientId: PATIENT_ID,
            age: 30,
            gender: undefined,
            systolic_bp: 120,
            bmi: 22.0,
            smoker: false,
            family_diabetes: false,
        });
    });

    test('parses only the systolic component out of "systolic/diastolic"', async () => {
        mockPost.mockResolvedValue({ data: { results: {} } });

        await aiIntegrationService.calculatePatientRisks({ id: PATIENT_ID, bloodPressure: '110/70' });

        expect(mockPost).toHaveBeenCalledWith(
            '/predict/calculate',
            expect.objectContaining({ systolic_bp: 110 })
        );
    });

    test('returns the AI response payload on success', async () => {
        const payload = { results: { cardiovascular: { score: 12 } } };
        mockPost.mockResolvedValue({ data: payload });

        const result = await aiIntegrationService.calculatePatientRisks({ id: PATIENT_ID });

        expect(result).toEqual(payload);
    });

    test('returns null (does not throw) when the AI service call fails', async () => {
        mockPost.mockRejectedValue(new Error('timeout'));

        const result = await aiIntegrationService.calculatePatientRisks({ id: PATIENT_ID });

        expect(result).toBeNull();
    });
});

describe('processMedicalDocument', () => {
    test('posts a multipart form containing the file buffer, and returns the AI response payload', async () => {
        mockPost.mockResolvedValue({ data: { entities: { name: 'John' } } });
        const buffer = Buffer.from('fake-pdf-bytes');

        const result = await aiIntegrationService.processMedicalDocument(buffer, 'report.pdf');

        expect(mockPost).toHaveBeenCalledTimes(1);
        const [url, form, options] = mockPost.mock.calls[0];
        expect(url).toBe('/process/document');
        expect(form.constructor.name).toBe('FormData');
        expect(options.headers).toEqual(expect.objectContaining({ 'content-type': expect.stringContaining('multipart/form-data') }));
        expect(result).toEqual({ entities: { name: 'John' } });
    });

    test('returns null (does not throw) when the AI service call fails', async () => {
        mockPost.mockRejectedValue(new Error('AI service down'));

        const result = await aiIntegrationService.processMedicalDocument(Buffer.from('x'), 'x.pdf');

        expect(result).toBeNull();
    });
});
