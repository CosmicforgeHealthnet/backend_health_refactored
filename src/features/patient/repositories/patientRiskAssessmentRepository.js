const AppDataSource = require("../../../config/database");
const PatientRiskAssessment = require("../entities/PatientRiskAssessment");

const assessmentStats = {
    getLatestAssessment: async (patientId, type) => {
        const repo = AppDataSource.getRepository(PatientRiskAssessment);
        return await repo.findOne({
            where: {
                patient: { id: patientId },
                assessmentType: type
            },
            order: { createdAt: "DESC" }
        });
    },

    saveAssessment: async (data) => {
        const repo = AppDataSource.getRepository(PatientRiskAssessment);
        const assessment = repo.create(data);
        return await repo.save(assessment);
    },

    getHistory: async (patientId) => {
        const repo = AppDataSource.getRepository(PatientRiskAssessment);
        return await repo.find({
            where: { patient: { id: patientId } },
            order: { createdAt: "DESC" },
            take: 20
        });
    }
};

module.exports = assessmentStats;
