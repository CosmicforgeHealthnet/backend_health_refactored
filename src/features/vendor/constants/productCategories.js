const PRODUCT_CATEGORIES = {
    health_wellness: {
        label: "Health and Wellness",
        subcategories: [
            "skincare_beauty",
            "hair_body_care",
            "personal_hygiene",
            "sexual_wellness",
            "men_women_care",
        ],
    },
    medical_supplies: {
        label: "Medical Supplies",
        subcategories: [
            "first_aid_kits",
            "diagnostic_tools",
            "mobility_aids",
            "surgical_disposable_supplies",
        ],
    },
    baby_mother_care: {
        label: "Baby and Mother Care",
        subcategories: [
            "baby_food",
            "diapers_wipes",
            "baby_clothing_care",
            "nursing_maternity_products",
        ],
    },
    fitness_lifestyle: {
        label: "Fitness and Lifestyle",
        subcategories: [
            "home_workout_equipment",
            "sports_accessories",
            "smart_watches_trackers",
            "weight_management_nutrition",
        ],
    },
    nutrition_healthy_living: {
        label: "Nutrition and Healthy Living",
        subcategories: [
            "vitamins_supplements",
            "herbal_natural_remedies",
            "energy_performance_products",
            "healthy_snacks_drinks",
        ],
    },
    others: {
        label: "Others",
        subcategories: [
            "health_gadgets_devices",
            "home_care_cleaning_essentials",
            "protective_safety_items",
            "aromatherapy_essential_oils",
        ],
    },
    medications: {
        label: "Medications",
        subcategories: [
            "prescription_drugs",
            "over_the_counter",
            "vitamins_otc",
            "topical_medications",
        ],
        hybridPharmacyOnly: true,
    },
};

const ALL_CATEGORY_KEYS    = Object.keys(PRODUCT_CATEGORIES);
const ALL_SUBCATEGORY_KEYS = Object.values(PRODUCT_CATEGORIES).flatMap((c) => c.subcategories);

module.exports = { PRODUCT_CATEGORIES, ALL_CATEGORY_KEYS, ALL_SUBCATEGORY_KEYS };
