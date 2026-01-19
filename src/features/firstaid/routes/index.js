const router = require("express").Router();

// Import route files
const webSyncRoutes = require("./content/syncRoutes");
const emergencyStepRoutes = require("./content/stepRoutes");
const conditionRoutes = require("./content/conditionRoutes");

// Mount routes with base paths
router.use("/content/sync", webSyncRoutes); 
router.use("/content/steps", emergencyStepRoutes); 
router.use("/content/conditions", conditionRoutes); 

module.exports = router;
