const communityEventRSVPRepository = require("../repositories/communityEventRSVPRepository");
const NotificationService = require("../../notifications/services/notificationService");

const notificationService = new NotificationService();
const REMINDER_WINDOW_MS = 60 * 60 * 1000; // notify once an event is within 1 hour of starting

async function runEventReminderJob() {
    const windowEnd = new Date(Date.now() + REMINDER_WINDOW_MS);
    const dueRsvps = await communityEventRSVPRepository.findDueReminders(windowEnd);

    let sent = 0;
    for (const rsvp of dueRsvps) {
        try {
            await notificationService.createNotification(
                rsvp.user.id,
                "notification",
                `Reminder: "${rsvp.event.title}" starts soon`,
                { communityId: rsvp.event.community?.id, eventId: rsvp.event.id, startAt: rsvp.event.startAt },
                "community"
            );
            await communityEventRSVPRepository.markReminderSent(rsvp.id);
            sent++;
        } catch (error) {
            console.error(`Failed to send event reminder for RSVP ${rsvp.id}:`, error.message);
        }
    }

    if (sent > 0) console.log(`📅 Sent ${sent} community event reminder(s)`);
    return sent;
}

module.exports = { runEventReminderJob };
