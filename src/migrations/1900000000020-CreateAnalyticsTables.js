module.exports = class CreateAnalyticsTables1900000000020 {
    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS analytics_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id VARCHAR NOT NULL,
                is_new_session BOOLEAN NOT NULL DEFAULT false,
                is_returning_visitor BOOLEAN NOT NULL DEFAULT false,
                event_type VARCHAR NOT NULL,
                page VARCHAR,
                referrer VARCHAR,
                user_type_intent VARCHAR NOT NULL DEFAULT 'unknown',
                event_data JSONB,
                utm_source VARCHAR,
                utm_medium VARCHAR,
                utm_campaign VARCHAR,
                utm_term VARCHAR,
                utm_content VARCHAR,
                device_type VARCHAR,
                device_browser VARCHAR,
                device_os VARCHAR,
                device_screen_width INT,
                geo_country VARCHAR,
                geo_city VARCHAR,
                geo_ip_hash VARCHAR,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analytics_events_user_type ON analytics_events(user_type_intent)`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS analytics_sessions (
                session_id VARCHAR PRIMARY KEY,
                first_seen TIMESTAMP WITH TIME ZONE NOT NULL,
                last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
                is_returning_visitor BOOLEAN NOT NULL DEFAULT false,
                user_type_intent VARCHAR NOT NULL DEFAULT 'unknown',
                geo_country VARCHAR,
                geo_city VARCHAR,
                device_type VARCHAR,
                referrer VARCHAR,
                utm_source VARCHAR,
                utm_medium VARCHAR,
                utm_campaign VARCHAR,
                pages_visited JSONB NOT NULL DEFAULT '[]',
                events_count INT NOT NULL DEFAULT 0,
                converted BOOLEAN NOT NULL DEFAULT false,
                conversion_event VARCHAR
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user_type ON analytics_sessions(user_type_intent)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analytics_sessions_country ON analytics_sessions(geo_country)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analytics_sessions_first_seen ON analytics_sessions(first_seen)`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS analytics_waitlist (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id VARCHAR NOT NULL,
                role VARCHAR NOT NULL,
                full_name VARCHAR,
                facility_name VARCHAR,
                email VARCHAR,
                phone VARCHAR,
                country VARCHAR,
                signed_up_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analytics_waitlist_role ON analytics_waitlist(role)`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_analytics_waitlist_signed_up ON analytics_waitlist(signed_up_at)`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS analytics_waitlist`);
        await queryRunner.query(`DROP TABLE IF EXISTS analytics_sessions`);
        await queryRunner.query(`DROP TABLE IF EXISTS analytics_events`);
    }
};
