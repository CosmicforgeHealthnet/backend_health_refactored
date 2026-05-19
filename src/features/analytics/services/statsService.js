const { AppDataSource } = require('../../../config/database');

const VALID_USER_TYPES = ['patient', 'doctor', 'pharmacy', 'lab', 'unknown'];
const VALID_ROLES = ['lab'];

function safeDate(val) {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

function buildSessionWhere(filters) {
    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (filters.from) { conditions.push(`first_seen >= $${idx++}`); params.push(filters.from); }
    if (filters.to)   { conditions.push(`first_seen <= $${idx++}`); params.push(filters.to); }
    if (filters.user_type) { conditions.push(`user_type_intent = $${idx++}`); params.push(filters.user_type); }
    if (filters.country)   { conditions.push(`geo_country = $${idx++}`); params.push(filters.country); }

    return { where: conditions.join(' AND '), params };
}

function buildEventWhere(filters) {
    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (filters.from) { conditions.push(`created_at >= $${idx++}`); params.push(filters.from); }
    if (filters.to)   { conditions.push(`created_at <= $${idx++}`); params.push(filters.to); }
    if (filters.session_id) { conditions.push(`session_id = $${idx++}`); params.push(filters.session_id); }
    if (filters.event_type) { conditions.push(`event_type = $${idx++}`); params.push(filters.event_type); }

    return { where: conditions.join(' AND '), params };
}

async function getStats({ from, to, user_type } = {}) {
    const db = AppDataSource;

    const fromDate = safeDate(from);
    const toDate = safeDate(to);
    const userType = VALID_USER_TYPES.includes(user_type) ? user_type : null;

    const sessionFilters = { from: fromDate, to: toDate, user_type: userType };
    const eventFilters = { from: fromDate, to: toDate };

    const sWhere = buildSessionWhere(sessionFilters);
    const eWhere = buildEventWhere(eventFilters);

    const [sessionStats] = await db.query(
        `SELECT COUNT(*) AS unique_sessions,
                SUM(CASE WHEN is_returning_visitor THEN 1 ELSE 0 END) AS returning_visitors
         FROM analytics_sessions WHERE ${sWhere.where}`,
        sWhere.params
    );

    const byUserTypeRows = await db.query(
        `SELECT user_type_intent, COUNT(*) AS count
         FROM analytics_sessions WHERE ${buildSessionWhere({ from: fromDate, to: toDate }).where}
         GROUP BY user_type_intent`,
        buildSessionWhere({ from: fromDate, to: toDate }).params
    );

    const topPages = await db.query(
        `SELECT page, COUNT(*) AS views
         FROM analytics_events
         WHERE event_type = 'page_view' AND page IS NOT NULL AND ${eWhere.where}
         GROUP BY page ORDER BY views DESC LIMIT 10`,
        eWhere.params
    );

    const sourceWhere = buildSessionWhere({ from: fromDate, to: toDate });
    const topSources = await db.query(
        `SELECT COALESCE(utm_source, 'direct') AS source, COUNT(*) AS count
         FROM analytics_sessions WHERE ${sourceWhere.where}
         GROUP BY COALESCE(utm_source, 'direct') ORDER BY count DESC LIMIT 10`,
        sourceWhere.params
    );

    const countryWhere = buildSessionWhere({ from: fromDate, to: toDate });
    const byCountry = await db.query(
        `SELECT geo_country AS country, COUNT(*) AS count
         FROM analytics_sessions
         WHERE geo_country IS NOT NULL AND ${countryWhere.where}
         GROUP BY geo_country ORDER BY count DESC LIMIT 20`,
        countryWhere.params
    );

    const deviceWhere = buildSessionWhere({ from: fromDate, to: toDate });
    const byDeviceRows = await db.query(
        `SELECT LOWER(device_type) AS device, COUNT(*) AS count
         FROM analytics_sessions
         WHERE device_type IS NOT NULL AND ${deviceWhere.where}
         GROUP BY LOWER(device_type)`,
        deviceWhere.params
    );

    const planInterest = await db.query(
        `SELECT event_data->>'plan_name' AS plan,
                event_data->>'user_type' AS user_type,
                SUM(CASE WHEN event_type = 'plan_view' THEN 1 ELSE 0 END) AS views,
                SUM(CASE WHEN event_type = 'plan_select' THEN 1 ELSE 0 END) AS selects
         FROM analytics_events
         WHERE event_type IN ('plan_view', 'plan_select')
           AND event_data->>'plan_name' IS NOT NULL
           AND ${eWhere.where}
         GROUP BY event_data->>'plan_name', event_data->>'user_type'
         ORDER BY views DESC`,
        eWhere.params
    );

    const [conversions] = await db.query(
        `SELECT
            SUM(CASE WHEN event_type = 'cta_click' AND (event_data->>'label' ILIKE '%patient%') THEN 1 ELSE 0 END) AS patient_register_clicks,
            SUM(CASE WHEN event_type = 'cta_click' AND (event_data->>'label' ILIKE '%doctor%') THEN 1 ELSE 0 END) AS doctor_register_clicks,
            SUM(CASE WHEN event_type = 'cta_click' AND event_data->>'label' = 'Pharmacy Sign Up' THEN 1 ELSE 0 END) AS pharmacy_signup_clicks,
            SUM(CASE WHEN event_type = 'cta_click' AND event_data->>'label' = 'Pharmacy Sign In' THEN 1 ELSE 0 END) AS pharmacy_signin_clicks,
            SUM(CASE WHEN event_type = 'waitlist_submit' AND event_data->>'role' = 'lab' THEN 1 ELSE 0 END) AS lab_waitlist_joins,
            SUM(CASE WHEN event_type = 'contact_submit' THEN 1 ELSE 0 END) AS contact_form_submissions
         FROM analytics_events WHERE ${eWhere.where}`,
        eWhere.params
    );

    const byDevice = {};
    for (const row of byDeviceRows) {
        byDevice[row.device || 'unknown'] = parseInt(row.count, 10);
    }

    const byUserType = {};
    for (const row of byUserTypeRows) {
        byUserType[row.user_type_intent] = parseInt(row.count, 10);
    }

    return {
        total_visitors: parseInt(sessionStats.unique_sessions, 10) || 0,
        unique_sessions: parseInt(sessionStats.unique_sessions, 10) || 0,
        returning_visitors: parseInt(sessionStats.returning_visitors, 10) || 0,
        by_user_type: byUserType,
        top_pages: topPages.map(r => ({ page: r.page, views: parseInt(r.views, 10) })),
        top_traffic_sources: topSources.map(r => ({ source: r.source, count: parseInt(r.count, 10) })),
        by_country: byCountry.map(r => ({ country: r.country, count: parseInt(r.count, 10) })),
        by_device: byDevice,
        plan_interest: planInterest.map(r => ({
            plan: r.plan,
            user_type: r.user_type,
            views: parseInt(r.views, 10),
            selects: parseInt(r.selects, 10),
        })),
        conversions: {
            patient_register_clicks: parseInt(conversions.patient_register_clicks || 0, 10),
            doctor_register_clicks: parseInt(conversions.doctor_register_clicks || 0, 10),
            pharmacy_signup_clicks: parseInt(conversions.pharmacy_signup_clicks || 0, 10),
            pharmacy_signin_clicks: parseInt(conversions.pharmacy_signin_clicks || 0, 10),
            lab_waitlist_joins: parseInt(conversions.lab_waitlist_joins || 0, 10),
            contact_form_submissions: parseInt(conversions.contact_form_submissions || 0, 10),
        },
    };
}

async function getVisitors({ from, to, user_type, country, page, limit = 50, offset = 0 } = {}) {
    const db = AppDataSource;

    const fromDate = safeDate(from);
    const toDate = safeDate(to);
    const userType = VALID_USER_TYPES.includes(user_type) ? user_type : null;

    const filters = { from: fromDate, to: toDate, user_type: userType, country: country || null };
    const { where, params } = buildSessionWhere(filters);

    let pageCondition = '';
    let pageParams = [...params];
    if (page) {
        pageCondition = ` AND pages_visited @> $${pageParams.length + 1}::jsonb`;
        pageParams.push(JSON.stringify([page]));
    }

    const limitVal = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetVal = parseInt(offset, 10) || 0;

    const [countResult] = await db.query(
        `SELECT COUNT(*) AS total FROM analytics_sessions WHERE ${where}${pageCondition}`,
        pageParams
    );

    const rows = await db.query(
        `SELECT
            session_id, first_seen, last_seen, is_returning_visitor,
            user_type_intent, geo_country AS country, geo_city AS city,
            device_type AS device,
            COALESCE(utm_source, referrer, 'direct') AS referrer,
            utm_campaign, pages_visited, events_count, converted, conversion_event
         FROM analytics_sessions
         WHERE ${where}${pageCondition}
         ORDER BY first_seen DESC
         LIMIT ${limitVal} OFFSET ${offsetVal}`,
        pageParams
    );

    return {
        total: parseInt(countResult.total, 10) || 0,
        page: Math.floor(offsetVal / limitVal) + 1,
        limit: limitVal,
        data: rows,
    };
}

async function getEvents({ session_id, event_type, from, to, limit = 50, offset = 0 } = {}) {
    const db = AppDataSource;

    const fromDate = safeDate(from);
    const toDate = safeDate(to);

    const filters = { from: fromDate, to: toDate, session_id: session_id || null, event_type: event_type || null };
    const { where, params } = buildEventWhere(filters);

    const limitVal = Math.min(parseInt(limit, 10) || 50, 500);
    const offsetVal = parseInt(offset, 10) || 0;

    const [countResult] = await db.query(
        `SELECT COUNT(*) AS total FROM analytics_events WHERE ${where}`,
        params
    );

    const rows = await db.query(
        `SELECT * FROM analytics_events WHERE ${where} ORDER BY created_at DESC LIMIT ${limitVal} OFFSET ${offsetVal}`,
        params
    );

    return {
        total: parseInt(countResult.total, 10) || 0,
        page: Math.floor(offsetVal / limitVal) + 1,
        limit: limitVal,
        data: rows,
    };
}

async function getWaitlist({ role, from, to, limit = 50, offset = 0 } = {}) {
    const db = AppDataSource;

    const fromDate = safeDate(from);
    const toDate = safeDate(to);
    const safeRole = VALID_ROLES.includes(role) ? role : null;

    const conditions = ['1=1'];
    const params = [];
    let idx = 1;

    if (safeRole) { conditions.push(`role = $${idx++}`); params.push(safeRole); }
    if (fromDate) { conditions.push(`signed_up_at >= $${idx++}`); params.push(fromDate); }
    if (toDate)   { conditions.push(`signed_up_at <= $${idx++}`); params.push(toDate); }

    const where = conditions.join(' AND ');
    const limitVal = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetVal = parseInt(offset, 10) || 0;

    const [countResult] = await db.query(
        `SELECT COUNT(*) AS total FROM analytics_waitlist WHERE ${where}`,
        params
    );

    const rows = await db.query(
        `SELECT * FROM analytics_waitlist WHERE ${where} ORDER BY signed_up_at DESC LIMIT ${limitVal} OFFSET ${offsetVal}`,
        params
    );

    return {
        total: parseInt(countResult.total, 10) || 0,
        data: rows,
    };
}

module.exports = { getStats, getVisitors, getEvents, getWaitlist };
