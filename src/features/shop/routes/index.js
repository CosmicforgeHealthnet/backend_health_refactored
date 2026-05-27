const router = require("express").Router();

router.use("/", require("./shopRoutes"));

module.exports = router;
