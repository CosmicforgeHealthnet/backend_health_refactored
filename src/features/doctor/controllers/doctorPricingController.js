// ===================================
// src/features/doctor/controllers/doctorPricingController.js
// ===================================

const DoctorPricingService = require('../services/doctorPricingService');

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

            res.json({
                success: true,
                pricing
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
