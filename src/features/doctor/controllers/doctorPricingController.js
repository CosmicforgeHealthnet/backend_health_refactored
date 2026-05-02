// ===================================
// src/features/doctor/controllers/doctorPricingController.js
// ===================================

const DoctorPricingService = require('../services/doctorPricingService');
const CurrencyService = require('../../../shared/services/currencyService');

class DoctorPricingController {
    constructor() {
        this.pricingService = new DoctorPricingService();
    }

    async setPricing(req, res) {
        try {
            const { doctorId } = req.params;
            const pricingData = req.body;

            const pricing = await this.pricingService.setPricing(doctorId, pricingData);

            res.status(201).json({
                success: true,
                pricing,
                message: 'Pricing set successfully'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getDoctorPricing(req, res) {
        try {
            const { doctorId } = req.params;
            const pricing = await this.pricingService.getDoctorPricing(doctorId);

            // Only show prices in currencies both the patient recognises AND a provider can charge
            const SUPPORTED = new Set([
                ...CurrencyService.FALLBACK_PAYSTACK_CURRENCIES,
                ...CurrencyService.FALLBACK_FLUTTERWAVE_CURRENCIES
            ]);

            const countryCode = req.location?.countryCode || null;
            const requestedCurrency = req.query.currency ||
                (countryCode ? CurrencyService.getCurrencyForCountry(countryCode) : 'USD');

            // If currency isn't chargeable by either provider, fall back to USD
            // USD is always the fallback as per business requirement
            const patientCurrency = requestedCurrency && SUPPORTED.has(requestedCurrency)
                ? requestedCurrency
                : 'USD';

            // If no location or same currency as doctor, return as-is
            if (!patientCurrency || pricing.length === 0) {
                return res.json({
                    success: true,
                    pricing,
                    displayCurrency: pricing[0]?.currency || 'NGN',
                    location: req.location || null
                });
            }

            // Get exchange rates once for all items
            const rates = await CurrencyService.getExchangeRates();

            const convertedPricing = pricing.map(item => {
                const storedCurrency = item.currency || 'NGN';

                // Already in patient's currency — no conversion needed
                if (storedCurrency === patientCurrency) {
                    return { ...item, displayPrice: item.price, displayCurrency: patientCurrency, converted: false };
                }

                // Convert: stored currency → USD → patient currency
                const storedRate = rates[storedCurrency] || 1;
                const targetRate = rates[patientCurrency];

                if (!targetRate) {
                    // Currency not in rate table — fall back to USD
                    const usdAmount = Math.round((item.price / storedRate) * 100) / 100;
                    return { ...item, displayPrice: usdAmount, displayCurrency: 'USD', converted: true, fallback: true };
                }

                const usdAmount = item.price / storedRate;
                const displayPrice = Math.round(usdAmount * targetRate * 100) / 100;

                return {
                    ...item,
                    displayPrice,
                    displayCurrency: patientCurrency,
                    originalPrice: item.price,
                    originalCurrency: storedCurrency,
                    converted: true
                };
            });

            res.json({
                success: true,
                pricing: convertedPricing,
                displayCurrency: patientCurrency,
                location: req.location || null
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async updatePricing(req, res) {
        try {
            const { doctorId, pricingId } = req.params;
            const updateData = req.body;

            const pricing = await this.pricingService.updatePricing(doctorId, pricingId, updateData);

            res.json({
                success: true,
                pricing,
                message: 'Pricing updated successfully'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async deletePricing(req, res) {
        try {
            const { doctorId, pricingId } = req.params;
            await this.pricingService.deletePricing(doctorId, pricingId);

            res.json({
                success: true,
                message: 'Pricing deleted successfully'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = DoctorPricingController;
