// src/jobs/currencyRefreshJob.js
const CurrencyService = require('../services/currencyService');
const cron = require('node-cron');

class CurrencyRefreshJob {
  /**
   * Start the currency refresh job (runs every 6 hours)
   */
  static start() {
    // Run every 6 hours at minute 0
    cron.schedule('0 */6 * * *', async () => {
      try {
        console.log('🕒 Running scheduled currency refresh job...');
        await CurrencyService.refreshSupportedCurrencies();
        console.log('✅ Currency refresh job completed');
      } catch (error) {
        console.error('❌ Currency refresh job failed:', error);
      }
    });

    console.log('✅ Currency refresh job scheduled (every 6 hours)');
  }

  /**
   * Manual refresh trigger
   */
  static async runNow() {
    try {
      console.log('🔄 Manual currency refresh triggered...');
      const result = await CurrencyService.refreshSupportedCurrencies();
      return result;
    } catch (error) {
      console.error('❌ Manual currency refresh failed:', error);
      throw error;
    }
  }
}

module.exports = CurrencyRefreshJob;