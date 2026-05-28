const router = require("express").Router();

router.use("/", require("./cartRoutes"));

module.exports = router;
