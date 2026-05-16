const { AppDataSource } = require('../../../config/database');

const CONVERSION_EVENTS = new Set(['plan_select', 'waitlist_submit', 'contact_submit']);

async function trackEvent(payload) {
    const {
        session_id,
        is_new_session,
        is_returning_visitor,
        event_type,
        page,
        referrer,
        user_type_intent = 'unknown',
        event_data = {},
        utm = {},
        device = {},
        geo = {},
        timestamp,
    } = payload;

    const eventRepo = AppDataSource.getRepository('AnalyticsEvent');
    const sessionRepo = AppDataSource.getRepository('AnalyticsSession');
    const waitlistRepo = AppDataSource.getRepository('AnalyticsWaitlist');

    const event = eventRepo.create({
        session_id,
        is_new_session: !!is_new_session,
        is_returning_visitor: !!is_returning_visitor,
        event_type,
        page: page || null,
        referrer: referrer || null,
        user_type_intent,
        event_data,
        utm_source: utm.source || null,
        utm_medium: utm.medium || null,
        utm_campaign: utm.campaign || null,
        utm_term: utm.term || null,
        utm_content: utm.content || null,
        device_type: device.type || null,
        device_browser: device.browser || null,
        device_os: device.os || null,
        device_screen_width: device.screen_width || null,
        geo_country: geo.country || null,
        geo_city: geo.city || null,
        geo_ip_hash: geo.ip_hash || null,
    });
    await eventRepo.save(event);

    const now = (timestamp && !isNaN(new Date(timestamp).getTime()))
        ? new Date(timestamp)
        : new Date();

    const existing = await sessionRepo.findOneBy({ session_id });

    if (!existing) {
        const session = sessionRepo.create({
            session_id,
            first_seen: now,
            last_seen: now,
            is_returning_visitor: !!is_returning_visitor,
            user_type_intent,
            geo_country: geo.country || null,
            geo_city: geo.city || null,
            device_type: device.type || null,
            referrer: referrer || null,
            utm_source: utm.source || null,
            utm_medium: utm.medium || null,
            utm_campaign: utm.campaign || null,
            pages_visited: page ? [page] : [],
            events_count: 1,
            converted: CONVERSION_EVENTS.has(event_type),
            conversion_event: CONVERSION_EVENTS.has(event_type) ? event_type : null,
        });
        await sessionRepo.save(session);
    } else {
        const pages = Array.isArray(existing.pages_visited) ? [...existing.pages_visited] : [];
        if (page && !pages.includes(page)) pages.push(page);

        const updates = {
            last_seen: now,
            events_count: existing.events_count + 1,
            pages_visited: pages,
        };
        if (user_type_intent && user_type_intent !== 'unknown') {
            updates.user_type_intent = user_type_intent;
        }
        if (!existing.converted && CONVERSION_EVENTS.has(event_type)) {
            updates.converted = true;
            updates.conversion_event = event_type;
        }
        await sessionRepo.update({ session_id }, updates);
    }

    if (event_type === 'waitlist_submit' && event_data) {
        const entry = waitlistRepo.create({
            session_id,
            role: event_data.role || null,
            full_name: event_data.full_name || null,
            facility_name: event_data.facility_name || null,
            email: event_data.email || null,
            phone: event_data.phone || null,
            country: geo.country || null,
        });
        await waitlistRepo.save(entry);
    }

    return { ok: true };
}

module.exports = { trackEvent };
