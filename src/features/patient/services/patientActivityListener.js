const aiIntegrationService = require('./aiIntegrationService');

const patientRiskAssessmentRepository = require('../repositories/patientRiskAssessmentRepository');
const documentFileRepository = require('../../documents/repositories/documentFileRepository');

class PatientActivityListener {

    /**
     * Called when a patient profile is created or significantly updated.
     * Triggers a Risk Calculation.
     */
    async onPatientProfileUpdated(patientId, updatedProfile) {
        console.log(`👂 Listener: Patient ${patientId} profile updated. Triggering AI Risk Analysis...`);

        // Fire and forget (don't await result to block response)
        this._runRiskAnalysis(patientId, updatedProfile).catch(err =>
            console.error("Background AI Risk Task Failed:", err)
        );
    }

    /**
     * Called when a medical document is uploaded.
     * Triggers OCR and Entity Extraction.
     */
    async onDocumentUploaded(patientId, file) {
        console.log(`👂 Listener: Document uploaded for Patient ${patientId}. Triggering AI Processing...`);

        // Fire and forget
        this._processDocument(patientId, file).catch(err =>
            console.error("Background AI Doc Task Failed:", err)
        );
    }

    // --- Background Tasks ---

    async _runRiskAnalysis(patientId, profile) {
        const analysis = await aiIntegrationService.calculatePatientRisks(profile);

        if (analysis && analysis.results) {
            // 1. Save Cardiovascular Risk
            await patientRiskAssessmentRepository.saveAssessment({
                patient: { id: patientId },
                assessmentType: 'CVD',
                riskScore: analysis.results.cardiovascular.score,
                riskLevel: analysis.results.cardiovascular.risk_level,
                contributingFactors: analysis.results.cardiovascular.vectors,
                aiModelVersion: analysis.results.cardiovascular.model
            });

            // 2. Save Diabetes Risk
            await patientRiskAssessmentRepository.saveAssessment({
                patient: { id: patientId },
                assessmentType: 'DIABETES',
                riskScore: analysis.results.diabetes.score,
                riskLevel: analysis.results.diabetes.risk_level,
                contributingFactors: analysis.results.diabetes.vectors,
                aiModelVersion: analysis.results.diabetes.model
            });

            console.log(`✅ AI Risk Scores Saved for Patient ${patientId}`);
        }
    }

    async _processDocument(patientId, file) {
        if (!file.buffer && !file.filePath) return;

        // Handle both buffer (direct upload) and path (saved file)
        let buffer = file.buffer;
        const fs = require('fs').promises;
        if (!buffer && file.filePath) {
            try {
                // Need to handle path resolution logic based on your setup
                // For now, assuming buffer is passed or mocked
            } catch (e) { console.error(e); }
        }

        if (!buffer) return; // Skip if no content

        const result = await aiIntegrationService.processMedicalDocument(buffer, file.originalFileName || "doc.pdf");

        if (result && result.entities) {
            console.log(`🤖 AI Extracted Data:`, result.entities);

            // Update Document Metadata
            if (file.id && file.uploader && file.uploader.id) {
                const userId = file.uploader.id;
                const currentFile = await documentFileRepository.getFileById(file.id, userId);

                if (currentFile) {
                    const newMetadata = {
                        ...currentFile.metadata,
                        ai_extraction: result.entities,
                        ai_extracted_at: new Date().toISOString()
                    };

                    await documentFileRepository.updateFile(file.id, userId, {
                        metadata: newMetadata
                    });
                    console.log(`✅ Document ${file.id} metadata updated with AI insights.`);
                }
            }
        }
    }
}

module.exports = new PatientActivityListener();
