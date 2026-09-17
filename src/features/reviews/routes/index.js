const router = require("express").Router();

router.use("/", require("./reviewRoutes"));

module.exports = router;
