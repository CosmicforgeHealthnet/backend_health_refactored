// src/utils/subscriptionConstants.js

const SUBSCRIPTION_TIERS = {
    // Patient tiers
    PATIENT_FREE: "free",
    // PATIENT_BASIC: "basic",
    PATIENT_STANDARD: "standard",
    PATIENT_MEDIUM: "medium",
    PATIENT_PREMIUM: "premium",
    PATIENT_GOLD_ELITE: "gold_elite",

    // Doctor tiers
    DOCTOR_FREE: "free",
    // DOCTOR_BASIC: "basic",
    DOCTOR_PROFESSIONAL: "professional",
    DOCTOR_PREMIUM: "premium",

    // Legacy (for backward compatibility)
    // LEGACY_BASIC: "basic",
    LEGACY_PRO: "pro",
    LEGACY_ENTERPRISE: "enterprise",
};

const PROMO_EXPIRY = "2025-09-30T23:59:59Z"; // End of month

// DOCTOR SPECIALIZATION ACCESS LEVELS
// These define which doctors patients can access based on subscription tier
const DOCTOR_SPECIALIZATION_ACCESS = {
    // General/Emergency specializations (Basic tier access)
    GENERAL_EMERGENCY_SPECIALIZATIONS: ["general medicine", "emergency medicine"],

    // All other specializations require Premium tier
    // Premium users can book with ANY doctor regardless of specialization
};

const PLAN_DEFINITIONS = {
    // DOCTOR PLANS
    doctor: {
        free: {
            name: "Free Plan",
            price: { USD: 0.0, NGN: 0.0 },
            originalPrice: { USD: 0.0, NGN: 0.0 },
            discount: { USD: 0.0, NGN: 0.0 },
            discountPercentage: 0,
            promoExpiry: PROMO_EXPIRY,
            commissionRate: 30,
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
            price: { USD: 12.45, NGN: 12450.00 },
            originalPrice: { USD: 24.99, NGN: 24900.00 },
            discount: { USD: 12.45, NGN: 12450.00 },
            discountPercentage: 50,
            commissionRate: 20,
            features: {
                chatOnly: false,
                videoConsultation: true,
                regularProfileListing: true,
                topProfileListing: false,
                standardSupport: true,
                prioritySupport: false,
                unlimitedPatients: false,
                unlimitedAI: false
            },
            monthlyLimits: {
                maxPatients: 40,
                aiResponses: 200
            }
        },
        professional: {
            name: "Professional Plan",
            price: { USD: 22.49, NGN: 22450.0 },
            originalPrice: { USD: 44.99, NGN: 44900.0 },
            discount: { USD: 22.49, NGN: 22450.0 },
            discountPercentage: 50,
            promoExpiry: PROMO_EXPIRY,
            commissionRate: 15,
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
            price: { USD: 49.99, NGN: 49950.0 },
            originalPrice: { USD: 99.99, NGN: 99900.0 },
            discount: { USD: 49.99, NGN: 49950.0 },
            discountPercentage: 50,
            promoExpiry: PROMO_EXPIRY,
            commissionRate: 10,
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
    },

    // PATIENT PLANS
    patient: {
        free: {
            name: "Free Plan",
            price: { USD: 0.0, NGN: 0.0 },
            originalPrice: { USD: 0.0, NGN: 0.0 },
            discount: { USD: 0.0, NGN: 0.0 },
            discountPercentage: 0,
            promoExpiry: PROMO_EXPIRY,
            commissionRate: null,
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
                // aiChatbotResponses: 10,
                aiDiagnosticRequests: 0,
            },
            familyMembers: 1,
        },
        // basic: {
        //   name: "Basic Plan",
        //   price: { USD: 7.99, NGN: 7900.00 },
        //   originalPrice: { USD: 9.99, NGN: 9900.00 },
        //   discount: { USD: 2.00, NGN: 2000.00 },
        //   discountPercentage: 20,
        //   commissionRate: null,
        //   features: {
        //     chatOnly: false,
        //     voiceConsultation: true,
        //     videoConsultation: false,
        //     generalEmergencySpecialists: false,
        //     allSpecialists: true,
        //     labAccess: true,
        //     shopAccess: true,
        //     firstAidInstructions: false,
        //     familyPlan: false,
        //     standardSupport: true,
        //     prioritySupport: false,
        //     earlyAccessFeatures: false,
        //     betaAccess: false
        //   },
        //   monthlyLimits: {
        //     aiChatbotResponses: 30,
        //     aiDiagnosticRequests: 20
        //   },
        //   familyMembers: 1
        // },
        standard: {
            name: "Standard Plan",
            price: { USD: 0.0, NGN: 0.0 },
            originalPrice: { USD: 9.99, NGN: 9900.0 },
            discount: { USD: 9.99, NGN: 9900.0 },
            discountPercentage: 100,
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
                // aiChatbotResponses: 80,
                aiDiagnosticRequests: 50,
            },
            familyMembers: 1,
        },
        medium: {
            name: "Medium Plan",
            price: { USD: 8.99, NGN: 9950.0 },
            originalPrice: { USD: 17.99, NGN: 19900.0 },
            discount: { USD: 8.99, NGN: 9950.0 },
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
                // aiChatbotResponses: 200,
                aiDiagnosticRequests: 150,
            },
            familyMembers: 3,
        },
        premium: {
            name: "Premium Plan",
            price: { USD: 24.99, NGN: 24950.0 }, // 50% of original
            originalPrice: { USD: 49.99, NGN: 49900.0 },
            discount: { USD: 24.99, NGN: 24950.0 }, // half of original
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
                // aiChatbotResponses: -1,
                aiDiagnosticRequests: -1,
            },
            familyMembers: 5,
        },
        gold_elite: {
            name: "Gold Elite Plan",
            price: { USD: 49.99, NGN: 49950.0 },
            originalPrice: { USD: 99.99, NGN: 99900.0 },
            discount: { USD: 49.99, NGN: 49950.0 },
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
                // aiChatbotResponses: -1,
                aiDiagnosticRequests: -1,
            },
            familyMembers: -1,
        },
    },
};

// Legacy tier mapping for backward compatibility
const LEGACY_TIER_MAPPING = {
    // basic: { planType: "patient", tier: "basic" },
    pro: { planType: "patient", tier: "premium" },
    enterprise: { planType: "doctor", tier: "professional" },
};

// Dynamic currency regions (will be updated by CurrencyService)
const CURRENCY_REGIONS = {
    NGN: ["NG"], // Nigeria - uses predefined prices
    USD: ["US", "CA", "GB", "AU"], // Default USD countries
    // These will be populated dynamically by CurrencyService
    DYNAMIC_PAYSTACK: [], // Populated at runtime
    DYNAMIC_FLUTTERWAVE: [], // Populated at runtime
};

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
            originalAmount:
                planDefinition.originalPrice?.USD || planDefinition.price.USD,
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

// Simple countdown function
function getTimeUntilExpiry() {
    const now = new Date();
    const expiry = new Date(PROMO_EXPIRY);
    const timeLeft = expiry.getTime() - now.getTime();

    if (timeLeft <= 0) return "EXPIRED";

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    return `${days} days left`;
}

module.exports = {
    SUBSCRIPTION_TIERS,
    PLAN_DEFINITIONS,
    LEGACY_TIER_MAPPING,
    CURRENCY_REGIONS,
    DOCTOR_SPECIALIZATION_ACCESS,
    PROMO_EXPIRY,
    getTimeUntilExpiry,
    getPriceForCountry,
    getAvailableCurrencies,
    updateCurrencyRegions,
};
