const router = require("./routes");
const entities = require("./entities");

module.exports = {
    router,
    webhookRouter: require("./routes/webhooks"),
    entities
};
