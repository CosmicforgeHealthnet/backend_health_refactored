const express = require('express');
const PaymentController = require('../controllers/paymentController');

const router = express.Router();

router.post('/initiate', PaymentController.initiateLabPayment);

module.exports = router;
