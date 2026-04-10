// ================================
// 2. JOB SCHEDULER
// ================================

// src/job/paymentJobScheduler.js
const cron = require('node-cron');
const PaymentJobs = require('./paymentJobs');

class PaymentJobScheduler {
  
  static start() {
    console.log("🚀 Initializing payment background jobs...");

    // Run dispute window completion every hour
    cron.schedule('0 * * * *', async () => {
      console.log("⏰ Running dispute window completion job...");
      try {
        await PaymentJobs.processDisputeWindowCompletion();
      } catch (error) {
        console.error('❌ Dispute window completion job failed:', error);
      }
    });

    // Recover stuck processing transactions every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      console.log("⏰ Running stuck processing transaction recovery job...");
      try {
        await PaymentJobs.recoverStuckProcessingTransactions();
      } catch (error) {
        console.error('❌ Stuck processing recovery job failed:', error);
      }
    });

    // Run failed payment retry every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      console.log("⏰ Running failed payment retry job...");
      try {
        await PaymentJobs.retryFailedPayments();
      } catch (error) {
        console.error('❌ Failed payment retry job failed:', error);
      }
    });

    // Update currency rates every 4 hours
    cron.schedule('0 */4 * * *', async () => {
      console.log("⏰ Running currency rate update job...");
      try {
        await PaymentJobs.updateCurrencyRates();
      } catch (error) {
        console.error('❌ Currency rate update job failed:', error);
      }
    });

    // Process pending withdrawals every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      console.log("⏰ Running withdrawal processing job...");
      try {
        await PaymentJobs.processPendingWithdrawals();
      } catch (error) {
        console.error('❌ Withdrawal processing job failed:', error);
      }
    });

    // Cleanup old data daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log("⏰ Running data cleanup job...");
      try {
        await PaymentJobs.cleanupOldData();
      } catch (error) {
        console.error('❌ Data cleanup job failed:', error);
      }
    });

    console.log("✅ Payment background jobs initialized");
  }
}

module.exports = PaymentJobScheduler;