// Temporary dummy-data seed: "Heart Attack" condition + emergency steps for all categories
// Admin UI for creating this content isn't built yet, so seeding directly for staging.
// src/scripts/seedHeartAttackEmergencyStep.js
const AppDataSource = require("../config/database");
const contentService = require("../features/firstaid/services/contentService");

const GENERAL_STEPS = [
  "Call emergency services immediately.",
  "Have the person sit down, rest, and stay calm.",
  "Loosen any tight clothing around their chest and neck.",
  "If prescribed, help them take their aspirin or nitroglycerin.",
  "If they become unresponsive and stop breathing normally, begin CPR.",
  "Stay with them until emergency responders arrive.",
];

const STEPS_BY_CATEGORY = {
  general: GENERAL_STEPS,
  adults: GENERAL_STEPS,
  children: [
    "Call emergency services immediately.",
    "Keep the child calm, seated, or lying down with head slightly raised.",
    "Loosen tight clothing around the chest and neck.",
    "Do not give aspirin to a child unless a doctor has told you to.",
    "If they become unresponsive and stop breathing normally, begin child CPR.",
    "Stay with them until emergency responders arrive.",
  ],
  infants: [
    "Call emergency services immediately.",
    "Keep the infant calm and supported in a comfortable position.",
    "Do not give any medication to an infant.",
    "If they become unresponsive and stop breathing normally, begin infant CPR.",
    "Stay with them until emergency responders arrive.",
  ],
};

async function seedHeartAttackEmergencyStep() {
  try {
    console.log("Starting Heart Attack emergency step seeding...");

    const allConditions = await contentService.getConditions({});
    let condition = allConditions.find((c) => c.name === "Heart Attack");

    if (!condition) {
      condition = await contentService.createCondition({
        name: "Heart Attack",
        description:
          "A heart attack occurs when blood flow to part of the heart is blocked, causing damage to the heart muscle. Immediate action can save a life.",
        contentType: "emergency",
        severity: "critical",
        sortOrder: 0,
      });
      console.log(`Created condition "Heart Attack" (${condition.id})`);
    } else {
      console.log(`Condition "Heart Attack" already exists (${condition.id})`);
    }

    for (const [categoryType, steps] of Object.entries(STEPS_BY_CATEGORY)) {
      const existingStep = await contentService
        .getEmergencyStepByConditionAndCategory(condition.id, categoryType)
        .catch(() => null);

      if (existingStep) {
        console.log(`Emergency step for category "${categoryType}" already exists, skipping`);
        continue;
      }

      const step = await contentService.createEmergencyStep({
        conditionId: condition.id,
        categoryType,
        steps,
        sortOrder: 0,
      });
      console.log(`Seeded emergency step "${categoryType}" (${step.id})`);
    }

    console.log("Seeding complete.");
  } catch (error) {
    console.error("Seeding failed:", error);
    throw error;
  }
}

if (require.main === module) {
  AppDataSource.initialize()
    .then(() => seedHeartAttackEmergencyStep())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Script failed:", error);
      process.exit(1);
    });
}

module.exports = { seedHeartAttackEmergencyStep };
