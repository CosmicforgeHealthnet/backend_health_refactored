const UserJob = require("./features/patient/jobs/userJob")
const ReferralDrawJob = require("./features/auth/jobs/referralDrawJob");
const CurrencyRefreshJob = require("./features/payments/jobs/currencyRefreshJob");
const AppointmentJob = require("./features/appointments/jobs/appointmentJob");
const { startCleanupTasks } = require("./shared/services/cleanupService");
const VerificationReminderJob = require("./cron");
const DrawJob = new ReferralDrawJob();
const AppointmentRunJob = new AppointmentJob();


module.exports = async function runJobs() {
    // Start services
    startCleanupTasks();
    VerificationReminderJob.start();

    // Start the currency refresh job
    CurrencyRefreshJob.start();

    //scheduled job for user
    // UserJob.start();

    //scheduled job for referral draw
    DrawJob.start();

    AppointmentRunJob.initializeCronJobs();

    console.log("⏰ Cron jobs activated");

}