const { EntitySchema } = require("typeorm");

const AnalyticsSession = new EntitySchema({
    name: "AnalyticsSession",
    tableName: "analytics_sessions",
    columns: {
        session_id: { primary: true, type: "varchar" },
        first_seen: { type: "timestamp with time zone" },
        last_seen: { type: "timestamp with time zone" },
        is_returning_visitor: { type: "boolean", default: false },
        user_type_intent: { type: "varchar", default: "unknown" },
        geo_country: { type: "varchar", nullable: true },
        geo_city: { type: "varchar", nullable: true },
        device_type: { type: "varchar", nullable: true },
        referrer: { type: "varchar", nullable: true },
        utm_source: { type: "varchar", nullable: true },
        utm_medium: { type: "varchar", nullable: true },
        utm_campaign: { type: "varchar", nullable: true },
        pages_visited: { type: "jsonb", default: [] },
        events_count: { type: "int", default: 0 },
        converted: { type: "boolean", default: false },
        conversion_event: { type: "varchar", nullable: true }
    }
});

module.exports = { AnalyticsSession };
