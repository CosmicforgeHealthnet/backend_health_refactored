const axios = require('axios');


class AiIntegrationService {
    constructor() {
        // Fallback to local default if env var is missing
        this.baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001/api/v1';
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 10000 // 10s timeout
        });
    }

    /**
     * Send intake form data to AI for FHIR standardization
     * @param {string} patientId 
     * @param {object} formData 
     */
    async processIntakeForm(patientId, formData) {
        try {
            const response = await this.client.post('/ingest/intake', {
                patientId,
                formData
            });
            return response.data;
        } catch (error) {
            console.error('❌ AI Service Intake Error:', error.message);
            return null; // Don't break main flow
        }
    }

    /**
     * Send patient profile data for Risk Calculation
     * @param {object} patientProfile 
     */
    async calculatePatientRisks(patientProfile) {
        try {
            // Map patient profile to AI Service expectation
            const payload = {
                patientId: patientProfile.id,
                age: this._calculateAge(patientProfile.dateOfBirth),
                gender: patientProfile.gender,
                systolic_bp: this._parseBP(patientProfile.bloodPressure),
                bmi: patientProfile.bmi || 22.0,
                smoker: patientProfile.smokes || false,
                family_diabetes: false // Default/Placeholder as it might be deep in family history
            };

            const response = await this.client.post('/predict/calculate', payload);
            return response.data;
        } catch (error) {
            console.error('❌ AI Service Risk Error:', error.message);
            return null;
        }
    }

    /**
     * Process uploaded document for insights
     * @param {Buffer} fileBuffer 
     * @param {string} filename 
     */
    async processMedicalDocument(fileBuffer, filename) {
        try {
            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', fileBuffer, filename);

            const response = await this.client.post('/process/document', form, {
                headers: {
                    ...form.getHeaders()
                }
            });
            return response.data;
        } catch (error) {
            console.error('❌ AI Service Document Error:', error.message);
            return null;
        }
    }

    // Helpers
    _calculateAge(dob) {
        if (!dob) return 30; // Default
        const diff = Date.now() - new Date(dob).getTime();
        const ageDate = new Date(diff);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    }

    _parseBP(bpString) {
        if (!bpString) return 120;
        // Expect "120/80"
        const parts = bpString.split('/');
        return parseInt(parts[0]) || 120;
    }
}

module.exports = new AiIntegrationService();
