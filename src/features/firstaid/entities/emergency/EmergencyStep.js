// EmergencyStep.js
const { EntitySchema } = require("typeorm");

const CategoryTypeEnum = {
  GENERAL: "general",
  ADULTS: "adults",
  CHILDREN: "children",
  INFANTS: "infants",
};

module.exports = new EntitySchema({
  name: "EmergencyStep",
  tableName: "emergency_steps",
  columns: {
    id: { primary: true, type: "uuid", generated: "uuid" },
    condition_id: {
      type: "uuid",
      nullable: false,
    },
    categoryType: {
      type: "enum",
      enum: Object.values(CategoryTypeEnum),
      default: CategoryTypeEnum.GENERAL,
      nullable: false,
      name: "category_type",
      comment:
        "Target audience: general, adults, children, infants - defaults to general",
    },
    steps: {
      type: "jsonb",
      nullable: false,
      comment:
        "Array of step objects: [{title, instruction}, {title, instruction}, ...]",
    },
    // One-to-one relationship with DocumentFile for category image
    category_image_id: {
      type: "uuid",
      nullable: true,
      comment: "Image for this condition+category combination",
    },
    sortOrder: {
      type: "int",
      default: 0,
      name: "sort_order",
    },
    metadata: {
      type: "jsonb",
      nullable: true,
      comment: "Additional metadata for this condition+category combination",
    },
    createdAt: {
      type: "timestamp",
      createDate: true,
      name: "created_at",
    },
    updatedAt: {
      type: "timestamp",
      updateDate: true,
      name: "updated_at",
    },
  },
  relations: {
    condition: {
      type: "many-to-one",
      target: "Condition",
      joinColumn: { name: "condition_id" },
      nullable: false,
      onDelete: "CASCADE", // EmergencyStep will be deleted when Condition is deleted
    },
    categoryImage: {
      type: "one-to-one",
      target: "DocumentFile",
      joinColumn: { name: "category_image_id" },
      nullable: true,
      onDelete: "SET NULL", // Set to NULL when DocumentFile is deleted
    },
  },
  indices: [
    { name: "IDX_STEP_CONDITION", columns: ["condition_id"] },
    { name: "IDX_STEP_CATEGORY_TYPE", columns: ["categoryType"] },
    {
      name: "IDX_STEP_CONDITION_CATEGORY",
      columns: ["condition_id", "categoryType"],
    },
    { name: "IDX_STEP_IMAGE", columns: ["category_image_id"] },
    { name: "IDX_STEP_SORT", columns: ["sortOrder"] },
  ],
});
