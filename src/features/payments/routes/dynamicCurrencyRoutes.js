// src/routes/currencyRoutes.js
const router = require("express").Router();
const {
  convertCurrency,
  getSupportedCurrencies,
  checkCurrencySupport,
  getUserLocalCurrency
} = require("../controllers/dynamicCurrencyController");
const { getLocationFromIP } = require('../../../shared/middlewares/locationMiddleware');

// Apply location middleware to all routes
router.use(getLocationFromIP);

// Routes
router.post('/convert', convertCurrency);
router.get('/supported', getSupportedCurrencies);
router.get('/support/:currency', checkCurrencySupport);
router.get('/local', getUserLocalCurrency);

module.exports = router;