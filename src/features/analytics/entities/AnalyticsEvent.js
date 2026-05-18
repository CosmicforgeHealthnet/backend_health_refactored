const { EntitySchema } = require("typeorm");

const AnalyticsEvent = new EntitySchema({
    name: "AnalyticsEvent",
    tableName: "analytics_events",
    columns: {
        id: { primary: true, type: "uuid", generated: "uuid" },
        session_id: { type: "varchar" },
        is_new_session: { type: "boolean", default: false },
        is_returning_visitor: { type: "boolean", default: false },
        event_type: { type: "varchar" },
        page: { type: "varchar", nullable: true },
        referrer: { type: "varchar", nullable: true },
        user_type_intent: { type: "varchar", default: "unknown" },
        event_data: { type: "jsonb", nullable: true },
        utm_source: { type: "varchar", nullable: true },
        utm_medium: { type: "varchar", nullable: true },
        utm_campaign: { type: "varchar", nullable: true },
        utm_term: { type: "varchar", nullable: true },
        utm_content: { type: "varchar", nullable: true },
        device_type: { type: "varchar", nullable: true },
        device_browser: { type: "varchar", nullable: true },
        device_os: { type: "varchar", nullable: true },
        device_screen_width: { type: "int", nullable: true },
        geo_country: { type: "varchar", nullable: true },
        geo_city: { type: "varchar", nullable: true },
        geo_ip_hash: { type: "varchar", nullable: true },
        created_at: { createDate: true }
    }
});

module.exports = { AnalyticsEvent };
