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
 * PRICING STRUCTURE:
 * - price = the MAIN/BASE price (full price without discount)
 * - discountPrice = the discounted price (what user pays during promo)
 * - discountPercentage = percentage off
 *
 * DISCOUNT SYSTEM:
 * - Set PROMO_EXPIRY to a future date to enable discounts
 * - When promo is active, user pays discountPrice
 * - When promo is inactive, user pays price
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
// Set PROMO_EXPIRY in .env file:
// - FUTURE date to enable discounts (e.g., "2026-12-31T23:59:59Z")
// - PAST date to disable discounts (e.g., "2024-01-01T00:00:00Z")
// Falls back to a past date (disabled) if not set
const PROMO_EXPIRY = process.env.PROMO_EXPIRY || "2024-01-01T00:00:00Z";

// Default discount percentage for all plans (can be overridden per plan)
const DEFAULT_DISCOUNT_PERCENTAGE = parseInt(process.env.PROMO_DISCOUNT_PERCENTAGE, 10) || 50;

// DOCTOR SPECIALIZATION ACCESS LEVELS
const DOCTOR_SPECIALIZATION_ACCESS = {
    // General/Emergency specializations (Free tier access)
    GENERAL_EMERGENCY_SPECIALIZATIONS: ["general medicine", "emergency medicine"],
    // All other specializations require Basic+ tier
};

// ===========================================================================
// DOCTOR PLANS (WITH COMMISSION)
// ===========================================================================
/**
 * DOCTOR SUBSCRIPTION PLANS
 *
 * Commission Structure:
 * - Free: 30% commission per consultation
 * - Basic: 20% commission per consultation
 * - Professional: 15% commission per consultation
 * - Premium: 10% commission per consultation
 *
 * Feature Enforcement:
 * - maxPatients: Enforced via requireUsage("maxPatients") middleware in appointments/routes
 * - aiResponses: Enforced via requireUsage("aiResponses") middleware in chat/routes/chatbot.js
 * - videoConsultation: Enforced via requireFeature("videoConsultation") for meeting links
 * - Profile listing: Used for doctor search ranking/display
 */
const DOCTOR_PLANS = {
    free: {
        name: "Free Plan",
        // No discount for free plan
        price: { USD: 0.00, NGN: 0.00 },
        discountPrice: { USD: 0.00, NGN: 0.00 },
        discountPercentage: 0,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: 30, // 30% commission per consultation
        features: {
            chatAccess: false, // No chat in free plan
            videoConsultation: true, // Free plan has video consultation only
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
        // Display features for UI/documentation matching
        displayFeatures: [
            "Video Consultation Only",
            "Access to 10 Patients per month",
            "Regular Profile Listing",
            "Access to 50 AI Responses",
            "Access to Support",
        ],
    },
    basic: {
        name: "Basic Plan",
        // 50% discount: $24.99 -> $12.50
        price: { USD: 24.99, NGN: 24900.00 },
        discountPrice: { USD: 12.50, NGN: 12450.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: 20, // 20% commission per consultation
        features: {
            chatAccess: true, // Basic adds chat access
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
        // Display features for UI/documentation matching
        displayFeatures: [
            "Video Consultation",
            "Chat Access",
            "40 Patients per month",
            "200 AI Responses",
            "Regular Profile Listing",
            "Standard Support",
        ],
    },
    professional: {
        name: "Professional Plan",
        // 50% discount: $44.99 -> $22.50
        price: { USD: 44.99, NGN: 44900.00 },
        discountPrice: { USD: 22.50, NGN: 22450.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: 15, // 15% commission per consultation
        features: {
            chatAccess: true,
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
        // Display features for UI/documentation matching
        displayFeatures: [
            "Video Consultation",
            "Chat Access",
            "100 Patients per month",
            "400 AI Responses",
            "Top Profile Listing",
            "Priority Support",
        ],
    },
    premium: {
        name: "Premium Plan",
        // 50% discount: $99.99 -> $50.00
        price: { USD: 99.99, NGN: 99900.00 },
        discountPrice: { USD: 50.00, NGN: 49950.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: 10, // 10% commission per consultation
        features: {
            chatAccess: true,
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
        // Display features for UI/documentation matching
        displayFeatures: [
            "Video Consultation",
            "Chat Access",
            "Unlimited Patients",
            "Unlimited AI Responses",
            "Top Profile Listing",
            "Priority Support",
        ],
    },
};

// ===========================================================================
// PATIENT PLANS (NO COMMISSION)
// ===========================================================================
/**
 * PATIENT SUBSCRIPTION PLANS
 *
 * No commission applies to patient plans.
 *
 * Feature Enforcement:
 * - aiChatbotResponses: Enforced via requireUsage("aiChatbotResponses") in chat/routes/chatbot.js
 * - aiDiagnosticRequests: Enforced via requireUsage("aiDiagnosticRequests") in diagnostic routes
 * - voiceConsultation: Enforced via requireFeature("voiceConsultation") middleware
 * - videoConsultation: Enforced via requireFeature("videoConsultation") for meeting links
 * - generalEmergencySpecialists: Enforced via doctorSpecializationAccessMiddleware (Free tier only)
 * - allSpecialists: Enforced via doctorSpecializationAccessMiddleware (Basic+ tiers)
 * - labAccess: Enforced via requireFeature("labAccess") in LAB/routes
 * - pharmacy: Enforced via requireFeature("pharmacy") in pharmacy/routes
 * - shopAccess: Available to all tiers
 * - firstAidInstructions: Enforced via requireFeature("firstAidInstructions") in firstaid/routes
 * - familyPlan: Validated via FAMILY_PLAN_CONFIG and familyMembers limit
 */
const PATIENT_PLANS = {
    free: {
        name: "Free Plan",
        // No discount for free plan
        price: { USD: 0.00, NGN: 0.00 },
        discountPrice: { USD: 0.00, NGN: 0.00 },
        discountPercentage: 0,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: null, // No commission for patients
        features: {
            chatAccess: false, // No chat access in free plan
            voiceConsultation: false,
            videoConsultation: true, // Free plan has video consultation only
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
        // Display features for UI/documentation matching
        displayFeatures: [
            "Video Consultation Only",
            "10 AI Chatbot Responses",
            "Access to General & Emergency Specialists",
            "Access to Shop/Purchase",
            "Access to Support",
        ],
    },
    basic: {
        name: "Basic Plan",
        // 50% discount: $9.99 -> $5.00
        price: { USD: 9.99, NGN: 9900.00 },
        discountPrice: { USD: 5.00, NGN: 4950.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: null,
        features: {
            chatAccess: true, // Basic adds chat access
            voiceConsultation: true,
            videoConsultation: true, // Inherits from free
            generalEmergencySpecialists: true, // Inherits from free
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
        // Display features for UI/documentation matching
        displayFeatures: [
            "Video Consultation",
            "Voice Consultation",
            "Chat Access",
            "30 AI Chatbot Responses",
            "20 AI Diagnostic Requests",
            "All Department Specialists",
            "Lab Access",
            "Shop Access",
            "Standard Support",
        ],
    },
    standard: {
        name: "Standard Plan",
        // 50% discount: $14.99 -> $7.50
        price: { USD: 14.99, NGN: 15900.00 },
        discountPrice: { USD: 7.50, NGN: 7950.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: null,
        features: {
            chatAccess: true,
            voiceConsultation: true,
            videoConsultation: true,
            generalEmergencySpecialists: true,
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
        // Display features for UI/documentation matching
        displayFeatures: [
            "Video Consultation",
            "Voice Consultation",
            "Chat Access",
            "80 AI Chatbot Responses",
            "50 AI Diagnostic Requests",
            "All Department Specialists",
            "Lab Access",
            "Pharmacy Access",
            "Shop Access",
            "First Aid Instructions",
            "Standard Support",
        ],
    },
    medium: {
        name: "Medium Plan",
        // 50% discount: $19.99 -> $10.00
        price: { USD: 19.99, NGN: 24900.00 },
        discountPrice: { USD: 10.00, NGN: 12450.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: null,
        features: {
            chatAccess: true,
            voiceConsultation: true,
            videoConsultation: true,
            generalEmergencySpecialists: true,
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
        // Display features for UI/documentation matching
        displayFeatures: [
            "Video Consultation",
            "Voice Consultation",
            "Chat Access",
            "200 AI Chatbot Responses",
            "150 AI Diagnostic Requests",
            "All Department Specialists",
            "Lab Access",
            "Pharmacy Access",
            "Shop Access",
            "First Aid Instructions",
            "Family Plan: 1 Adult + 2 Children",
            "Standard Support",
        ],
    },
    premium: {
        name: "Premium Plan",
        // 50% discount: $49.99 -> $25.00
        price: { USD: 49.99, NGN: 49900.00 },
        discountPrice: { USD: 25.00, NGN: 24950.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: null,
        features: {
            chatAccess: true,
            voiceConsultation: true,
            videoConsultation: true,
            generalEmergencySpecialists: true,
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
        // Display features for UI/documentation matching
        displayFeatures: [
            "Video Consultation",
            "Voice Consultation",
            "Chat Access",
            "Unlimited AI Chatbot Responses",
            "Unlimited AI Diagnostic Requests",
            "All Department Specialists",
            "Lab Access",
            "Pharmacy Access",
            "Shop Access",
            "First Aid Instructions",
            "Family Plan: 2 Adults + 3 Children",
            "Priority Support",
        ],
    },
    gold_elite: {
        name: "Gold Elite Plan",
        // 50% discount: $99.99 -> $50.00
        price: { USD: 99.99, NGN: 129900.00 },
        discountPrice: { USD: 50.00, NGN: 64950.00 },
        discountPercentage: 50,
        promoExpiry: PROMO_EXPIRY,
        commissionRate: null,
        features: {
            chatAccess: true,
            voiceConsultation: true,
            videoConsultation: true,
            generalEmergencySpecialists: true,
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
        // Display features for UI/documentation matching
        displayFeatures: [
            "Video Consultation",
            "Voice Consultation",
            "Chat Access",
            "Unlimited AI Chatbot Responses",
            "Unlimited AI Diagnostic Requests",
            "All Department Specialists",
            "Lab Access",
            "Pharmacy Access",
            "Shop Access",
            "First Aid Instructions",
            "Family Plan: Unlimited Dependents",
            "Priority Support",
            "Early Access to Platform Features",
            "Beta Access to New Cosmicforge Products",
        ],
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
            discountAmount: planDefinition.discountPrice?.USD || planDefinition.price.USD,
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

// Calculate the effective price (discounted if promo active, otherwise base price)
function getEffectivePrice(plan, currency = "USD") {
    if (!isPromoActive() || !plan.discountPercentage) {
        return plan.price[currency];
    }
    return plan.discountPrice?.[currency] || plan.price[currency];
}

// Get full pricing info for a plan
// - price: The MAIN/BASE price (what user would pay without discount)
// - discountPrice: The price AFTER discount (what user actually pays during promo)
function getPlanPricingInfo(plan, currency = "USD") {
    const promoActive = isPromoActive();
    const hasDiscount = promoActive && plan.discountPercentage > 0;
    const basePrice = plan.price[currency];
    const discountPrice = hasDiscount ? (plan.discountPrice?.[currency] || basePrice) : basePrice;
    const discountAmount = hasDiscount ? (basePrice - discountPrice) : 0;

    return {
        price: basePrice,
        discountPrice,
        discount: discountAmount,
        discountPercentage: hasDiscount ? plan.discountPercentage : 0,
        hasDiscount,
        promoActive,
        promoExpiry: PROMO_EXPIRY,
        timeLeft: promoActive ? getTimeUntilExpiry() : null,
        currency
    };
}

// Get display features for a plan (human-readable feature list)
function getPlanDisplayFeatures(planType, tier) {
    const plan = getPlan(planType, tier);
    return plan?.displayFeatures || [];
}

// Get all plan details for display (used by frontend)
function getPlanDetailsForDisplay(planType, tier, currency = "USD") {
    const plan = getPlan(planType, tier);
    if (!plan) return null;

    const pricing = getPlanPricingInfo(plan, currency);

    return {
        name: plan.name,
        tier,
        planType,
        pricing,
        features: plan.features,
        displayFeatures: plan.displayFeatures || [],
        monthlyLimits: plan.monthlyLimits,
        commissionRate: plan.commissionRate,
        familyMembers: plan.familyMembers || null,
        familyConfig: planType === "patient" ? FAMILY_PLAN_CONFIG[tier] : null,
    };
}

// Get all plans for a type (doctor or patient) with full details
function getAllPlansForDisplay(planType, currency = "USD") {
    const plans = PLAN_DEFINITIONS[planType];
    if (!plans) return [];

    return Object.keys(plans).map(tier => getPlanDetailsForDisplay(planType, tier, currency));
}

// ===========================================================================
// FEATURE ENFORCEMENT REFERENCE
// ===========================================================================
/**
 * FEATURE ENFORCEMENT LOCATIONS
 *
 * This section documents where each subscription feature is enforced in the codebase.
 * Use this as a reference when adding new features or debugging access issues.
 *
 * USAGE LIMITS (requireUsage middleware):
 * ----------------------------------------
 * | Feature             | Middleware Location                        | Enforced In                        |
 * |---------------------|--------------------------------------------|------------------------------------|
 * | maxPatients         | requireUsage("maxPatients")                | appointments/routes (doctor-approval) |
 * | aiResponses         | requireUsage("aiResponses")                | chat/routes/chatbot.js (doctorchat)  |
 * | aiChatbotResponses  | requireUsage("aiChatbotResponses")         | chat/routes/chatbot.js (chat)        |
 * | aiDiagnosticRequests| requireUsage("aiDiagnosticRequests")       | diagnostic routes                    |
 *
 * FEATURE FLAGS (requireFeature middleware):
 * ------------------------------------------
 * | Feature              | Middleware Location                       | Enforced In                          |
 * |----------------------|-------------------------------------------|--------------------------------------|
 * | chatAccess           | requireFeature("chatAccess")              | chat/routes (patient/doctor chat)    |
 * | videoConsultation    | requireFeature("videoConsultation")       | appointments/routes (meeting links)  |
 * | voiceConsultation    | requireFeature("voiceConsultation")       | consultation routes                  |
 * | labAccess            | requireFeature("labAccess")               | LAB/routes                           |
 * | pharmacy             | requireFeature("pharmacy")                | pharmacy/routes/prescriptionRoutes.js|
 * | firstAidInstructions | requireFeature("firstAidInstructions")    | firstaid/routes/stepRoutes.js        |
 * | familyPlan           | requireFeature("familyPlan")              | family member routes                 |
 * | earlyAccessFeatures  | requireFeature("earlyAccessFeatures")     | beta feature routes                  |
 * | betaAccess           | requireFeature("betaAccess")              | beta product routes                  |
 *
 * SPECIALIST ACCESS (doctorSpecializationAccessMiddleware):
 * ---------------------------------------------------------
 * | Feature                    | Allowed Specializations                     | Tier Access       |
 * |----------------------------|---------------------------------------------|-------------------|
 * | generalEmergencySpecialists| "general medicine", "emergency medicine"   | Free              |
 * | allSpecialists             | All doctor specializations                  | Basic+ tiers      |
 *
 * FAMILY PLAN LIMITS:
 * -------------------
 * | Tier       | Adults | Children | Total | Description              |
 * |------------|--------|----------|-------|--------------------------|
 * | free       | 1      | 0        | 1     | Individual only          |
 * | basic      | 1      | 0        | 1     | Individual only          |
 * | standard   | 1      | 0        | 1     | Individual only          |
 * | medium     | 1      | 2        | 3     | 1 Adult + 2 Children     |
 * | premium    | 2      | 3        | 5     | 2 Adults + 3 Children    |
 * | gold_elite | -1     | -1       | -1    | Unlimited dependents     |
 *
 * COMMISSION RATES (Doctor Plans):
 * --------------------------------
 * | Plan         | Commission |
 * |--------------|------------|
 * | Free         | 30%        |
 * | Basic        | 20%        |
 * | Professional | 15%        |
 * | Premium      | 10%        |
 */

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
    getEffectivePrice,
    getPlanPricingInfo,
    getPlanDisplayFeatures,
    getPlanDetailsForDisplay,
    getAllPlansForDisplay,
};
