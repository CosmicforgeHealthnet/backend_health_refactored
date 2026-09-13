// Temporary dummy-data seed: emergency steps (all categories) for every active first-aid condition
// Admin UI for creating this content isn't built yet, so seeding directly for staging.
// src/scripts/seedAllConditionEmergencySteps.js
const AppDataSource = require("../config/database");
const contentService = require("../features/firstaid/services/contentService");

const CATEGORIES = ["general", "adults", "children", "infants"];

function dummyStepsFor(conditionName) {
  return [
    `Call emergency services immediately for ${conditionName}.`,
    "Keep the person calm and in a safe, comfortable position.",
    "Monitor their breathing and responsiveness closely.",
    "Do not give food, drink, or medication unless directed by a professional.",
    "Stay with them until emergency responders arrive.",
  ];
}

async function seedAllConditionEmergencySteps() {
  try {
    console.log("Starting bulk emergency step seeding...");

    const conditions = await contentService.getConditions({ isActive: true });
    console.log(`Found ${conditions.length} active conditions`);

    let seededCount = 0;

    for (const condition of conditions) {
      for (const categoryType of CATEGORIES) {
        const existingStep = await contentService
          .getEmergencyStepByConditionAndCategory(condition.id, categoryType)
          .catch(() => null);

        if (existingStep) continue;

        const step = await contentService.createEmergencyStep({
          conditionId: condition.id,
          categoryType,
          steps: dummyStepsFor(condition.name),
          sortOrder: 0,
        });
        console.log(
          `Seeded "${condition.name}" (${condition.id}) / ${categoryType} -> ${step.id}`
        );
        seededCount++;
      }
    }

    console.log(`Seeding complete. Created ${seededCount} emergency steps.`);
  } catch (error) {
    console.error("Seeding failed:", error);
    throw error;
  }
}

if (require.main === module) {
  AppDataSource.initialize()
    .then(() => seedAllConditionEmergencySteps())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Script failed:", error);
      process.exit(1);
    });
}

module.exports = { seedAllConditionEmergencySteps };
