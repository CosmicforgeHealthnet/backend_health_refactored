const router = require("./routes");
const entities = require("./entities");
const express = require("express");

// Public callback router — no auth required (Paystack/Flutterwave redirect here)
const callbackRouter = express.Router();
const PaymentController = require("./controllers/paymentController");
callbackRouter.get("/", PaymentController.handlePaymentCallback);

module.exports = {
    router,
    webhookRouter: require("./routes/webhooks"),
    callbackRouter,
    entities
};
