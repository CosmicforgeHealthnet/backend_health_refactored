const { EntitySchema } = require("typeorm");

const AnalyticsWaitlist = new EntitySchema({
    name: "AnalyticsWaitlist",
    tableName: "analytics_waitlist",
    columns: {
        id: { primary: true, type: "uuid", generated: "uuid" },
        session_id: { type: "varchar" },
        role: { type: "varchar" },
        full_name: { type: "varchar", nullable: true },
        facility_name: { type: "varchar", nullable: true },
        email: { type: "varchar", nullable: true },
        phone: { type: "varchar", nullable: true },
        country: { type: "varchar", nullable: true },
        signed_up_at: { createDate: true }
    }
});

module.exports = { AnalyticsWaitlist };
