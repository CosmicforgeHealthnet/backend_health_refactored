const router = require("./routes");
const faqRouter = require("./routes/faq");
const services = require("./services");
const aiLiveSupportRouter = require("./routes/aiLiveSupport");
const aiSupportAdminRouter = require("./routes/aiSupportAdmin");

module.exports = {
    router,
    faqRouter,
    services,
    aiLiveSupportRouter,
    aiSupportAdminRouter,
};
