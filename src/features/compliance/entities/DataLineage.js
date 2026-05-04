// src/entities/DataLineage.js
const { EntitySchema } = require("typeorm");

const DataLineageSchema = new EntitySchema({
  name: "DataLineage",
  tableName: "data_lineage",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    
    // Source Information
    sourceId: {
      type: "uuid",
      nullable: false,
      name: "source_id",
      comment: "ID of the source data entity"
    },
    
    sourceType: {
      type: "varchar",
      nullable: false,
      name: "source_type",
      comment: "Type of source (file, patient, system, etc.)"
    },
    
    sourceLocation: {
      type: "varchar",
      nullable: true,
      name: "source_location",
      comment: "Physical or logical location of source"
    },
    
    // Destination Information
    destinationId: {
      type: "uuid",
      nullable: true,
      name: "destination_id"
    },
    
    destinationType: {
      type: "varchar",
      nullable: true,
      name: "destination_type"
    },
    
    destinationLocation: {
      type: "varchar",
      nullable: true,
      name: "destination_location"
    },
    
    // Transformation Information
    transformationType: {
      type: "varchar",
      nullable: false,
      name: "transformation_type",
      comment: "Type of transformation (copy, anonymize, aggregate, etc.)"
    },
    
    transformationRules: {
      type: "jsonb",
      nullable: true,
      name: "transformation_rules",
      comment: "Specific rules applied during transformation"
    },
    
    algorithmUsed: {
      type: "varchar",
      nullable: true,
      name: "algorithm_used",
      comment: "Algorithm or method used for transformation"
    },
    
    // Data Quality
    dataQualityScore: {
      type: "int",
      nullable: true,
      name: "data_quality_score",
      comment: "Quality score of the transformed data (0-100)"
    },
    
    qualityMetrics: {
      type: "jsonb",
      nullable: true,
      name: "quality_metrics",
      comment: "Detailed quality metrics"
    },
    
    // Privacy Information
    privacyLevel: {
      type: "varchar",
      nullable: true,
      name: "privacy_level",
      comment: "Privacy level after transformation"
    },
    
    anonymizationLevel: {
      type: "varchar",
      nullable: true,
      name: "anonymization_level",
      comment: "Level of anonymization applied"
    },
    
    privacyBudgetUsed: {
      type: "decimal",
      precision: 10,
      scale: 6,
      nullable: true,
      name: "privacy_budget_used",
      comment: "Differential privacy budget consumed"
    },
    
    // Audit Information
    transformedBy: {
      type: "uuid",
      nullable: false,
      name: "transformed_by"
    },
    
    transformedAt: {
      type: "timestamp",
      nullable: false,
      name: "transformed_at"
    },
    
    purposeOfTransformation: {
      type: "varchar",
      nullable: false,
      name: "purpose_of_transformation"
    },
    
    // Compliance
    complianceChecks: {
      type: "jsonb",
      nullable: true,
      name: "compliance_checks",
      comment: "Compliance checks performed during transformation"
    },
    
    retentionPolicy: {
      type: "varchar",
      nullable: true,
      name: "retention_policy",
      comment: "Data retention policy applied"
    },
    
    // Metadata
    metadata: {
      type: "jsonb",
      nullable: true,
      comment: "Additional transformation metadata"
    }
  },
  
  relations: {
    transformer: {
      type: "many-to-one",
      target: "User",
      joinColumn: { name: "transformed_by" },
      nullable: false
    }
  },
  
  indices: [
    { name: "IDX_LINEAGE_SOURCE", columns: ["sourceId", "sourceType"] },
    { name: "IDX_LINEAGE_DESTINATION", columns: ["destinationId", "destinationType"] },
    { name: "IDX_LINEAGE_TRANSFORMATION", columns: ["transformationType"] },
    { name: "IDX_LINEAGE_TRANSFORMED_AT", columns: ["transformedAt"] },
    { name: "IDX_LINEAGE_PRIVACY", columns: ["privacyLevel"] }
  ]
});

module.exports = DataLineageSchema;
module.exports.DataLineageSchema = DataLineageSchema;
