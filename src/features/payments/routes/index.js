const express = require('express');
const router = express.Router();
const paymentRoutes = require('./payment');
const paymentMethodRoutes = require('./paymentMethod');
const walletRoutes = require('./wallet');

router.use('/', paymentRoutes);
router.use('/methods', paymentMethodRoutes);
router.use('/wallet', walletRoutes);
router.use('/disputes', require('./dispute'));

module.exports = router;
