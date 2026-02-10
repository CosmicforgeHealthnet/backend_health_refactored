// src/features/subscriptions/utils/subscriptionConstants.js
/**
 * COSMICFORGE TELEMEDICINE PLATFORM - SUBSCRIPTION CONSTANTS
 *
 * This file defines all subscription plans for Doctors and Patients.
 * - Doctors have commission rates per consultation
 * - Patients have no commission
 * - NGN pricing applies to Nigerian users only
 * - Other African countries (Paystack regions) get converted pricing
 * - Rest of world pays in USD
 *
 * DISCOUNT SYSTEM:
 * - Set PROMO_EXPIRY to a future date to enable discounts
 * - price = discounted price (what user pays during promo)
 * - originalPrice = full price (shown as strikethrough)
 * - discountPercentage = percentage off
 */

const SUBSCRIPTION_TIERS = {
    // Patient tiers
    PATIENT_FREE: "free",
    PATIENT_BASIC: "basic",
    PATIENT_STANDARD: "standard",
    PATIENT_MEDIUM: "medium",
    PATIENT_PREMIUM: "premium",
    PATIENT_GOLD_ELITE: "gold_elite",

    // Doctor tiers
    DOCTOR_FREE: "free",
    DOCTOR_BASIC: "basic",
    DOCTOR_PROFESSIONAL: "professional",
    DOCTOR_PREMIUM: "premium",

    // Legacy (for backward compatibility)
    LEGACY_PRO: "pro",
    LEGACY_ENTERPRISE: "enterprise",
};

// ===========================================================================
// PROMOTIONAL PRICING CONFIGURATION
// ===========================================================================
// Set to a FUTURE date to enable discounts (e.g., "2026-12-31T23:59:59Z")
// Set to a PAST date to disable discounts (e.g., "2024-01-01T00:00:00Z")
const PROMO_EXPIRY = "2026-12-31T23:59:59Z"; // Active promo until end of 2026

// Default discount percentage for all plans (can be overridden per plan)
const DEFAULT_DISCOUNT_PERCENTAGE = 50;

// DOCTOR SPECIALIZATION ACCESS LEVELS
const DOCTOR_SPECIALIZATION_ACCESS = {
    // General/Emergency specializations (Free tier access)
    GENERAL_EMERGENCY_SPECIALIZATIONS: ["general medicine", "emergency medicine"],
    // All other specializations require Basic+ tier
};

// ===========================================================================
// DOCTOR PLANS (WITH COMMISSION)
// ===========================================================================
const DOCTOR_PLANS = {
    free: {
        name: "Free Plan",
        // No discount for free plan
        price: { USD: 0.00, NGN: 0.00 },
        originalPrice: { USD: 0.00, NGN: 0.00 },
        discount: { USD: 0.00, NGN: 0.00 },
        discountPercentage: 0,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: 30, // 30% commission per consultation
        features: {
            chatOnly: true,
            videoConsultation: false,
            regularProfileListing: true,
            topProfileListing: false,
            standardSupport: true,
            prioritySupport: false,
            unlimitedPatients: false,
            unlimitedAI: false,
        },
        monthlyLimits: {
            maxPatients: 10,
            aiResponses: 50,
        },
    },
    basic: {
        name: "Basic Plan",
        // 50% discount: $24.99 -> $12.50
        price: { USD: 12.50, NGN: 12450.00 },
        originalPrice: { USD: 24.99, NGN: 24900.00 },
        discount: { USD: 12.49, NGN: 12450.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: 20, // 20% commission per consultation
        features: {
            chatOnly: false,
            videoConsultation: true,
            regularProfileListing: true,
            topProfileListing: false,
            standardSupport: true,
            prioritySupport: false,
            unlimitedPatients: false,
            unlimitedAI: false,
        },
        monthlyLimits: {
            maxPatients: 40,
            aiResponses: 200,
        },
    },
    professional: {
        name: "Professional Plan",
        // 50% discount: $44.99 -> $22.50
        price: { USD: 22.50, NGN: 22450.00 },
        originalPrice: { USD: 44.99, NGN: 44900.00 },
        discount: { USD: 22.49, NGN: 22450.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: 15, // 15% commission per consultation
        features: {
            chatOnly: false,
            videoConsultation: true,
            regularProfileListing: false,
            topProfileListing: true,
            standardSupport: false,
            prioritySupport: true,
            unlimitedPatients: false,
            unlimitedAI: false,
        },
        monthlyLimits: {
            maxPatients: 100,
            aiResponses: 400,
        },
    },
    premium: {
        name: "Premium Plan",
        // 50% discount: $99.99 -> $50.00
        price: { USD: 50.00, NGN: 49950.00 },
        originalPrice: { USD: 99.99, NGN: 99900.00 },
        discount: { USD: 49.99, NGN: 49950.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: 10, // 10% commission per consultation
        features: {
            chatOnly: false,
            videoConsultation: true,
            regularProfileListing: false,
            topProfileListing: true,
            standardSupport: false,
            prioritySupport: true,
            unlimitedPatients: true,
            unlimitedAI: true,
        },
        monthlyLimits: {
            maxPatients: -1, // Unlimited
            aiResponses: -1, // Unlimited
        },
    },
};

// ===========================================================================
// PATIENT PLANS (NO COMMISSION)
// ===========================================================================
const PATIENT_PLANS = {
    free: {
        name: "Free Plan",
        // No discount for free plan
        price: { USD: 0.00, NGN: 0.00 },
        originalPrice: { USD: 0.00, NGN: 0.00 },
        discount: { USD: 0.00, NGN: 0.00 },
        discountPercentage: 0,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: null, // No commission for patients
        features: {
            chatOnly: true,
            voiceConsultation: false,
            videoConsultation: false,
            generalEmergencySpecialists: true,
            allSpecialists: false,
            labAccess: false,
            pharmacy: false,
            shopAccess: true,
            firstAidInstructions: false,
            familyPlan: false,
            standardSupport: true,
            prioritySupport: false,
            earlyAccessFeatures: false,
            betaAccess: false,
        },
        monthlyLimits: {
            aiChatbotResponses: 10,
            aiDiagnosticRequests: 0,
        },
        familyMembers: 1, // Individual only
    },
    basic: {
        name: "Basic Plan",
        // 50% discount: $9.99 -> $5.00
        price: { USD: 5.00, NGN: 4950.00 },
        originalPrice: { USD: 9.99, NGN: 9900.00 },
        discount: { USD: 4.99, NGN: 4950.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: null,
        features: {
            chatOnly: false,
            voiceConsultation: true,
            videoConsultation: false,
            generalEmergencySpecialists: false,
            allSpecialists: true,
            labAccess: true,
            pharmacy: false,
            shopAccess: true,
            firstAidInstructions: false,
            familyPlan: false,
            standardSupport: true,
            prioritySupport: false,
            earlyAccessFeatures: false,
            betaAccess: false,
        },
        monthlyLimits: {
            aiChatbotResponses: 30,
            aiDiagnosticRequests: 20,
        },
        familyMembers: 1, // Individual only
    },
    standard: {
        name: "Standard Plan",
        // 50% discount: $14.99 -> $7.50
        price: { USD: 7.50, NGN: 7950.00 },
        originalPrice: { USD: 14.99, NGN: 15900.00 },
        discount: { USD: 7.49, NGN: 7950.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: null,
        features: {
            chatOnly: false,
            voiceConsultation: true,
            videoConsultation: true,
            generalEmergencySpecialists: false,
            allSpecialists: true,
            labAccess: true,
            pharmacy: true,
            shopAccess: true,
            firstAidInstructions: true,
            familyPlan: false,
            standardSupport: true,
            prioritySupport: false,
            earlyAccessFeatures: false,
            betaAccess: false,
        },
        monthlyLimits: {
            aiChatbotResponses: 80,
            aiDiagnosticRequests: 50,
        },
        familyMembers: 1, // Individual only
    },
    medium: {
        name: "Medium Plan",
        // 50% discount: $19.99 -> $10.00
        price: { USD: 10.00, NGN: 12450.00 },
        originalPrice: { USD: 19.99, NGN: 24900.00 },
        discount: { USD: 9.99, NGN: 12450.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: null,
        features: {
            chatOnly: false,
            voiceConsultation: true,
            videoConsultation: true,
            generalEmergencySpecialists: false,
            allSpecialists: true,
            labAccess: true,
            pharmacy: true,
            shopAccess: true,
            firstAidInstructions: true,
            familyPlan: true,
            standardSupport: true,
            prioritySupport: false,
            earlyAccessFeatures: false,
            betaAccess: false,
        },
        monthlyLimits: {
            aiChatbotResponses: 200,
            aiDiagnosticRequests: 150,
        },
        familyMembers: 3, // 1 Adult + 2 Children
    },
    premium: {
        name: "Premium Plan",
        // 50% discount: $49.99 -> $25.00
        price: { USD: 25.00, NGN: 24950.00 },
        originalPrice: { USD: 49.99, NGN: 49900.00 },
        discount: { USD: 24.99, NGN: 24950.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: null,
        features: {
            chatOnly: false,
            voiceConsultation: true,
            videoConsultation: true,
            generalEmergencySpecialists: false,
            allSpecialists: true,
            labAccess: true,
            pharmacy: true,
            shopAccess: true,
            firstAidInstructions: true,
            familyPlan: true,
            standardSupport: false,
            prioritySupport: true,
            earlyAccessFeatures: false,
            betaAccess: false,
        },
        monthlyLimits: {
            aiChatbotResponses: -1, // Unlimited
            aiDiagnosticRequests: -1, // Unlimited
        },
        familyMembers: 5, // 2 Adults + 3 Children
    },
    gold_elite: {
        name: "Gold Elite Plan",
        // 50% discount: $99.99 -> $50.00
        price: { USD: 50.00, NGN: 64950.00 },
        originalPrice: { USD: 99.99, NGN: 129900.00 },
        discount: { USD: 49.99, NGN: 64950.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: null,
        features: {
            chatOnly: false,
            voiceConsultation: true,
            videoConsultation: true,
            generalEmergencySpecialists: false,
            allSpecialists: true,
            labAccess: true,
            pharmacy: true,
            shopAccess: true,
            firstAidInstructions: true,
            familyPlan: true,
            standardSupport: false,
            prioritySupport: true,
            earlyAccessFeatures: true,
            betaAccess: true,
        },
        monthlyLimits: {
            aiChatbotResponses: -1, // Unlimited
            aiDiagnosticRequests: -1, // Unlimited
        },
        familyMembers: -1, // Unlimited dependents
    },
};

// Combined PLAN_DEFINITIONS for backward compatibility
const PLAN_DEFINITIONS = {
    doctor: DOCTOR_PLANS,
    patient: PATIENT_PLANS,
};

// Legacy tier mapping for backward compatibility
const LEGACY_TIER_MAPPING = {
    pro: { planType: "patient", tier: "premium" },
    enterprise: { planType: "doctor", tier: "professional" },
};

// Dynamic currency regions (will be updated by CurrencyService)
const CURRENCY_REGIONS = {
    NGN: ["NG"], // Nigeria - uses predefined NGN prices
    USD: ["US", "CA", "GB", "AU"], // Default USD countries
    // African countries with Paystack - prices converted from USD
    PAYSTACK_REGIONS: ["NG", "GH", "ZA", "KE"],
    // These will be populated dynamically by CurrencyService
    DYNAMIC_PAYSTACK: [],
    DYNAMIC_FLUTTERWAVE: [],
};

// Family plan configuration
const FAMILY_PLAN_CONFIG = {
    free: { adults: 1, children: 0, total: 1, description: "Individual only" },
    basic: { adults: 1, children: 0, total: 1, description: "Individual only" },
    standard: { adults: 1, children: 0, total: 1, description: "Individual only" },
    medium: { adults: 1, children: 2, total: 3, description: "1 Adult + 2 Children" },
    premium: { adults: 2, children: 3, total: 5, description: "2 Adults + 3 Children" },
    gold_elite: { adults: -1, children: -1, total: -1, description: "Unlimited dependents" },
};

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

// Helper functions for dynamic currency integration
async function getPriceForCountry(planDefinition, countryCode) {
    try {
        const CurrencyService = require("../../../shared/services/currencyService");
        return await CurrencyService.getPlanPricingForCountry(
            planDefinition,
            countryCode
        );
    } catch (error) {
        console.error("Error getting price for country:", error);

        // Fallback to USD pricing
        return {
            amount: planDefinition.price.USD,
            originalAmount: planDefinition.originalPrice?.USD || planDefinition.price.USD,
            currency: "USD",
            countryCode,
            fallback: true,
            error: error.message,
        };
    }
}

async function getAvailableCurrencies() {
    try {
        const CurrencyService = require("../../../shared/services/currencyService");
        const currencies = await CurrencyService.getAllSupportedCurrencies();
        return currencies.all;
    } catch (error) {
        console.error("Error getting available currencies:", error);
        return ["USD", "NGN", "GHS", "ZAR", "KES", "EUR", "GBP"];
    }
}

// Update currency regions with dynamic data
async function updateCurrencyRegions() {
    try {
        const CurrencyService = require("../../../shared/services/currencyService");
        const currencies = await CurrencyService.getAllSupportedCurrencies();

        CURRENCY_REGIONS.DYNAMIC_PAYSTACK = currencies.paystack;
        CURRENCY_REGIONS.DYNAMIC_FLUTTERWAVE = currencies.flutterwave;

        return CURRENCY_REGIONS;
    } catch (error) {
        console.error("Error updating currency regions:", error);
        return CURRENCY_REGIONS;
    }
}

// Simple countdown function for promo
function getTimeUntilExpiry() {
    const now = new Date();
    const expiry = new Date(PROMO_EXPIRY);
    const timeLeft = expiry.getTime() - now.getTime();

    if (timeLeft <= 0) return "EXPIRED";

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} left`;
    }
    return `${hours} hour${hours > 1 ? 's' : ''} left`;
}

// Check if promo is active
function isPromoActive() {
    return new Date() < new Date(PROMO_EXPIRY);
}

// Get plan by type and tier
function getPlan(planType, tier) {
    return PLAN_DEFINITIONS[planType]?.[tier] || null;
}

// Get commission rate for a doctor's plan
function getDoctorCommissionRate(tier) {
    const plan = DOCTOR_PLANS[tier];
    return plan?.commissionRate || 30; // Default to 30% if not found
}

// Check if tier has family plan access
function hasFamilyPlanAccess(tier) {
    const config = FAMILY_PLAN_CONFIG[tier];
    return config && config.total > 1;
}

// Get family member limit for tier
function getFamilyMemberLimit(tier) {
    const config = FAMILY_PLAN_CONFIG[tier];
    return config?.total || 1;
}

// Calculate discounted price for a plan
function getDiscountedPrice(plan, currency = "USD") {
    if (!isPromoActive() || !plan.discountPercentage) {
        return plan.originalPrice?.[currency] || plan.price[currency];
    }
    return plan.price[currency];
}

// Get full pricing info for a plan
function getPlanPricingInfo(plan, currency = "USD") {
    const promoActive = isPromoActive();
    const hasDiscount = promoActive && plan.discountPercentage > 0;

    return {
        price: hasDiscount ? plan.price[currency] : (plan.originalPrice?.[currency] || plan.price[currency]),
        originalPrice: plan.originalPrice?.[currency] || plan.price[currency],
        discount: hasDiscount ? plan.discount?.[currency] || 0 : 0,
        discountPercentage: hasDiscount ? plan.discountPercentage : 0,
        hasDiscount,
        promoActive,
        promoExpiry: PROMO_EXPIRY,
        timeLeft: getTimeUntilExpiry(),
        currency
    };
}

module.exports = {
    SUBSCRIPTION_TIERS,
    PLAN_DEFINITIONS,
    DOCTOR_PLANS,
    PATIENT_PLANS,
    LEGACY_TIER_MAPPING,
    CURRENCY_REGIONS,
    DOCTOR_SPECIALIZATION_ACCESS,
    FAMILY_PLAN_CONFIG,
    PROMO_EXPIRY,
    DEFAULT_DISCOUNT_PERCENTAGE,
    getTimeUntilExpiry,
    isPromoActive,
    getPriceForCountry,
    getAvailableCurrencies,
    updateCurrencyRegions,
    getPlan,
    getDoctorCommissionRate,
    hasFamilyPlanAccess,
    getFamilyMemberLimit,
    getDiscountedPrice,
    getPlanPricingInfo,
};
