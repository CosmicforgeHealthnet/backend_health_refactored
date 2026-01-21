const { EntitySchema } = require("typeorm");

module.exports = new EntitySchema({
    name: "PatientRiskAssessment",
    tableName: "patient_risk_assessments",
    columns: {
        id: {
            primary: true,
            type: "uuid",
            generated: "uuid",
        },
        assessmentType: {
            type: "varchar", // e.g., 'CVD', 'DIABETES', 'FALL_RISK'
            nullable: false,
        },
        riskScore: {
            type: "float",
            nullable: false,
        },
        riskLevel: {
            type: "varchar", // 'LOW', 'MODERATE', 'HIGH'
            nullable: true,
        },
        contributingFactors: {
            type: "jsonb", // Array of factors: ['Age > 40', 'Smoker']
            nullable: true,
        },
        aiModelVersion: {
            type: "varchar",
            nullable: true,
        },
        createdAt: {
            type: "timestamp",
            createDate: true,
        },
    },
    relations: {
        patient: {
            target: "PatientProfile",
            type: "many-to-one",
            joinColumn: { name: "patient_id" },
            nullable: false,
            onDelete: "CASCADE",
        },
    },
});
