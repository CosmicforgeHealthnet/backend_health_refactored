// All prices in NGN
const PROMOTION_PRICING = {
    one_day:   5_000,
    one_week:  25_000,
    one_month: 80_000,
    per_day:   5_000, // rate used for custom duration
};

const PROMOTION_SUBTYPES = {
    boost_account: ["profile_visibility_boost", "more_profile_visits"],
    get_sales:     ["more_product_visibility", "discounted_sales", "more_orders"],
    campaign:      [], // campaign has no subtype — uses CampaignProduct instead
};

const GET_SALES_MAX_PRODUCTS = 5;

function calculatePrice(duration, customDays) {
    if (duration === "custom") {
        if (!customDays || customDays < 1) throw new Error("customDays must be at least 1");
        return PROMOTION_PRICING.per_day * customDays;
    }
    return PROMOTION_PRICING[duration];
}

function calculateEndDate(startDate, duration, customDays) {
    const end = new Date(startDate);
    if (duration === "one_day")   end.setDate(end.getDate() + 1);
    if (duration === "one_week")  end.setDate(end.getDate() + 7);
    if (duration === "one_month") end.setMonth(end.getMonth() + 1);
    if (duration === "custom")    end.setDate(end.getDate() + customDays);
    return end;
}

module.exports = {
    PROMOTION_PRICING,
    PROMOTION_SUBTYPES,
    GET_SALES_MAX_PRODUCTS,
    calculatePrice,
    calculateEndDate,
};
