const express = require('express');
const router = express.Router();
const paymentRoutes = require('./payment');
const paymentMethodRoutes = require('./paymentMethod');
const walletRoutes = require('./wallet');
const disputeRoutes = require('./dispute');
const dynamicCurrencyRoutes = require('./dynamicCurrency');

router.use('/', paymentRoutes);
router.use('/methods', paymentMethodRoutes);
router.use('/wallet', walletRoutes);
router.use('/disputes', disputeRoutes);
router.use('/dynamicCurrency', dynamicCurrencyRoutes);

module.exports = router;