// src/controllers/dynamicCurrencyController.js
const CurrencyService = require('../services/dynamicCurrencyService');

const currencyService = new CurrencyService();

const convertCurrency = async (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency } = req.body;
    
    if (!amount || !fromCurrency) {
      return res.status(400).json({
        success: false,
        error: 'Amount and fromCurrency are required',
        example: { amount: 100, fromCurrency: 'USD' }
      });
    }

    const userCountry = req.location?.country || 'Nigeria';
    
    const result = await currencyService.convertCurrency({
      amount: parseFloat(amount),
      fromCurrency: fromCurrency.toUpperCase(),
      userCountry,
      toCurrency: toCurrency?.toUpperCase()
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

const getSupportedCurrencies = async (req, res) => {
  try {
    const currencies = currencyService.getSupportedCurrencies();
    res.json({
      success: true,
      data: currencies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const checkCurrencySupport = async (req, res) => {
  try {
    const { currency } = req.params;
    const support = currencyService.getPaymentGatewaySupport(currency);
    
    res.json({
      success: true,
      data: support
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const getUserLocalCurrency = async (req, res) => {
  try {
    const userCountry = req.location?.country || 'Nigeria';
    const currency = await currencyService.getCountryCurrency(userCountry);
    
    res.json({
      success: true,
      data: {
        country: userCountry,
        currency,
        isSupported: currencyService.isCurrencySupported(currency),
        paymentGateways: currencyService.getPaymentGatewaySupport(currency)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  convertCurrency,
  getSupportedCurrencies,
  checkCurrencySupport,
  getUserLocalCurrency
};