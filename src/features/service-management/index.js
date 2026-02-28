const router = require("./routes");
const entities = require("./entities");

module.exports = {
  router,
  entities,
  name: "service-management",
  version: "1.0.0",
  description: "Dynamic service availability management with countdown timers and real-time status updates",
};
