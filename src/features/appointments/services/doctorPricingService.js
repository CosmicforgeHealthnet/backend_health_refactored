// ===================================
// src/services/DoctorPricingService.js
// ===================================
const DoctorPricingRepository = require('../repositories/doctorPricingRepository');

class DoctorPricingService {
  constructor() {
    this.pricingRepository = new DoctorPricingRepository();
  }

  async setPricing(doctorId, pricingData) {
    try {
      // Check if pricing already exists for this type
      const existingPricingDuration = await this.pricingRepository.findByDoctorAndTypeAndDuration(
        doctorId,
        pricingData.consultationType,
        pricingData.duration
      );

      if (existingPricingDuration) {
        // Update existing pricing
        return await this.pricingRepository.update(existingPricingDuration.id, {
          price: pricingData.price,
          duration: pricingData.duration,
          currency: pricingData.currency,
          updatedAt: new Date()
        });
      } else {
        // Create new pricing
        return await this.pricingRepository.create({
          doctorId,
          ...pricingData
        });
      }
    } catch (error) {
      throw new Error(`Failed to set pricing: ${error.message}`);
    }
  }

  async getDoctorPricing(doctorId) {
    return await this.pricingRepository.findByDoctorId(doctorId);
  }

  async getPricingForConsultationType(doctorId, consultationType, duration) {
    const pricing = await this.pricingRepository.findByDoctorAndTypeAndDuration(doctorId, consultationType, duration);
    if (!pricing) {
      throw new Error(`No pricing found for consultation type: ${consultationType} and druration: ${duration}`);
    }
    return pricing;
  }

  async updatePricing(doctorId, pricingId, updateData) {
    return await this.pricingRepository.update(pricingId, updateData);
  }

  async deletePricing(doctorId, pricingId) {
    return await this.pricingRepository.delete(pricingId);
  }
}

module.exports = DoctorPricingService;