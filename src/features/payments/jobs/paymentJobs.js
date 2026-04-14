// src/job/paymentJobs.js
const transactionRepository = require('../repositories/transactionRepository');
const transactionSplitRepository = require('../repositories/transactionSplitRepository');
const doctorWalletRepository = require('../repositories/doctorWalletRepository');
const walletWithdrawalRepository = require('../repositories/walletWithdrawalRepository');
const walletService = require('../services/walletService');
const userPaymentMethodRepository = require('../repositories/userPaymentMethodRepository');
const axios = require('axios');

class PaymentJobs {
  /**
   * ENHANCED: Process dispute window completion with appointment logic
   */
  static async processDisputeWindowCompletion() {
    try {
      console.log('🔄 Processing enhanced dispute window completion...');

      const now = new Date();

      // STEP 1: Start dispute window for appointments that happened today or earlier
      await this.startDisputeWindowForAppointments(now);

      // STEP 2: Release funds for completed dispute windows
      await this.releaseFundsAfterDisputeWindow(now);

      console.log('🎉 Enhanced dispute window processing completed');
    } catch (error) {
      console.error('❌ Error in enhanced dispute window completion job:', error);
      throw error;
    }
  }

  /**
   * NEW: Start dispute window for appointments that have occurred
   */
  static async startDisputeWindowForAppointments(now) {
    try {
      // Find transactions waiting for appointment that have occurred
      const waitingTransactions = await transactionRepository.repo.createQueryBuilder('transaction')
        .where('transaction.status = :status', { status: 'completed' })
        .andWhere('transaction.serviceType = :serviceType', { serviceType: 'appointment' })
        .andWhere('transaction.fundsStatus = :fundsStatus', { fundsStatus: 'pending_appointment' })
        .andWhere('transaction.appointmentDate <= :now', { now })
        .getMany();

      let processedCount = 0;

      for (const transaction of waitingTransactions) {
        try {
          // Update dispute window timing
          const disputeWindowEndsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

          await transactionRepository.repo.update(transaction.id, {
            disputeWindowStartsAt: now,
            disputeWindowEndsAt,
            fundsStatus: 'pending_dispute'
          });

          // Add to doctor's pending credits
          const splits = await transactionSplitRepository.findByTransactionId(transaction.id);
          const doctorSplit = splits.find(split => split.recipientType === 'doctor_wallet');

          if (doctorSplit) {
            await doctorWalletRepository.addPendingCredits(
              transaction.doctorId,
              doctorSplit.usdAmount
            );

            console.log(`✅ Started dispute window for appointment payment ${transaction.id} - added $${doctorSplit.usdAmount} to pending credits`);
          }

          processedCount++;
        } catch (error) {
          console.error(`❌ Error starting dispute window for transaction ${transaction.id}:`, error);
        }
      }

      console.log(`📅 Started dispute window for ${processedCount} appointment payments`);
      return processedCount;

    } catch (error) {
      console.error('❌ Error starting dispute windows for appointments:', error);
      throw error;
    }
  }

  /**
   * NEW: Release funds after dispute window ends
   */
  static async releaseFundsAfterDisputeWindow(now) {
    try {
      // Find transactions with expired dispute windows
      const expiredTransactions = await transactionRepository.repo.createQueryBuilder('transaction')
        .where('transaction.status = :status', { status: 'completed' })
        .andWhere('transaction.fundsStatus = :fundsStatus', { fundsStatus: 'pending_dispute' })
        .andWhere('transaction.disputeWindowEndsAt <= :now', { now })
        .andWhere('transaction.isCancelled = :isCancelled', { isCancelled: false })
        .getMany();

      let releasedCount = 0;

      for (const transaction of expiredTransactions) {
        try {
          // Release funds to doctor's available balance
          const splits = await transactionSplitRepository.findByTransactionId(transaction.id);

          for (const split of splits) {
            if (split.recipientType === 'doctor_wallet' && split.status === 'pending') {
              await doctorWalletRepository.releasePendingCredits(
                split.recipientId,
                split.usdAmount
              );

              await transactionSplitRepository.updateStatus(split.id, 'released');

              console.log(`✅ Released $${split.usdAmount} to doctor ${split.recipientId} (${transaction.serviceType} payment)`);
            }
          }

          // Update transaction status
          await transactionRepository.repo.update(transaction.id, {
            fundsStatus: 'released'
          });

          releasedCount++;
        } catch (error) {
          console.error(`❌ Error releasing funds for transaction ${transaction.id}:`, error);
        }
      }

      console.log(`💰 Released funds for ${releasedCount} transactions`);
      return releasedCount;

    } catch (error) {
      console.error('❌ Error releasing funds after dispute window:', error);
      throw error;
    }
  }

  /**
   * NEW: Get appointment payment statistics
   */
  static async getAppointmentPaymentStats() {
    try {
      const stats = await transactionRepository.repo.createQueryBuilder('transaction')
        .select([
          'COUNT(CASE WHEN fundsStatus = \'pending_appointment\' THEN 1 END) as waitingForAppointment',
          'COUNT(CASE WHEN fundsStatus = \'pending_dispute\' THEN 1 END) as pendingDispute',
          'COUNT(CASE WHEN fundsStatus = \'released\' THEN 1 END) as released',
          'SUM(CASE WHEN fundsStatus = \'pending_appointment\' THEN usdAmount ELSE 0 END) as amountWaitingForAppointment',
          'SUM(CASE WHEN fundsStatus = \'pending_dispute\' THEN usdAmount ELSE 0 END) as amountPendingDispute'
        ])
        .where('serviceType = :serviceType', { serviceType: 'appointment' })
        .andWhere('status = :status', { status: 'completed' })
        .getRawOne();

      return {
        waitingForAppointment: parseInt(stats.waitingForAppointment || 0),
        pendingDispute: parseInt(stats.pendingDispute || 0),
        released: parseInt(stats.released || 0),
        amountWaitingForAppointment: parseFloat(stats.amountWaitingForAppointment || 0),
        amountPendingDispute: parseFloat(stats.amountPendingDispute || 0)
      };

    } catch (error) {
      console.error('❌ Error getting appointment payment stats:', error);
      return null;
    }
  }

  /**
   * Recover transactions stuck in processing state.
   * Runs every 15 minutes. Verifies status directly with the payment provider
   * so no payment is ever permanently lost due to a missed webhook.
   */
  static async recoverStuckProcessingTransactions() {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const stuckTransactions = await transactionRepository.repo.createQueryBuilder('transaction')
        .where('transaction.status = :status', { status: 'processing' })
        .andWhere('transaction.updatedAt < :thirtyMinutesAgo', { thirtyMinutesAgo })
        .andWhere('transaction.providerReference IS NOT NULL')
        .getMany();

      if (stuckTransactions.length === 0) return { recoveredCount: 0, failedCount: 0 };

      console.log(`🔍 Found ${stuckTransactions.length} stuck processing transaction(s) — verifying with providers...`);

      const paymentService = require('../services/paymentService');
      let recoveredCount = 0;
      let failedCount = 0;

      for (const transaction of stuckTransactions) {
        try {
          const isFlutterwave = transaction.providerReference?.startsWith('FLW-');
          const isPaystack = transaction.providerReference?.startsWith('PST-');

          let verificationResult = null;

          if (isFlutterwave && transaction.providerTransactionId) {
            verificationResult = await paymentService.verifyFlutterwavePayment(transaction.providerTransactionId);
          } else if (isPaystack) {
            verificationResult = await paymentService.verifyPaystackPayment(transaction.providerReference);
          } else {
            continue;
          }

          if (verificationResult && verificationResult.success) {
            // Atomic conditional update — only completes if still in processing
            const updated = await transactionRepository.repo.createQueryBuilder()
              .update()
              .set({
                status: 'completed',
                completedAt: new Date(),
                providerFee: verificationResult.data?.app_fee || verificationResult.data?.fees || 0
              })
              .where('id = :id AND status = :status', { id: transaction.id, status: 'processing' })
              .execute();

            if (updated.affected > 0) {
              // Process funds — idempotency guard inside each method prevents double-credit
              if (transaction.serviceType === 'appointment' && transaction.doctorId) {
                await paymentService.processFundsForAppointmentPayment(transaction);
              } else if (transaction.doctorId) {
                await paymentService.processFundsImmediate(transaction);
              }
              console.log(`✅ Recovered stuck transaction ${transaction.id} — marked completed`);
              recoveredCount++;
            }
          } else if (transaction.updatedAt < twoHoursAgo) {
            // Stuck for 2+ hours and provider confirms it didn't succeed — mark failed
            await transactionRepository.repo.createQueryBuilder()
              .update()
              .set({ status: 'failed', failedAt: new Date() })
              .where('id = :id AND status = :status', { id: transaction.id, status: 'processing' })
              .execute();
            console.log(`❌ Transaction ${transaction.id} stuck >2 hours with no provider confirmation — marked failed`);
            failedCount++;
          }
          // else: < 2 hours and not confirmed yet — leave it, retry on next run
        } catch (error) {
          console.error(`❌ Error recovering transaction ${transaction.id}:`, error);
        }
      }

      console.log(`🎉 Recovery complete — recovered: ${recoveredCount}, failed: ${failedCount}`);
      return { recoveredCount, failedCount };
    } catch (error) {
      console.error('❌ Error in recoverStuckProcessingTransactions:', error);
      throw error;
    }
  }

  /**
   * Retry failed payments
   */
  static async retryFailedPayments() {
    try {
      console.log('🔄 Processing failed payment retries...');

      const retryableFailures = await transactionRepository.createQueryBuilder('transaction')
        .where('transaction.status = :status', { status: 'failed' })
        .andWhere('transaction.failedAt > :since', { since: new Date(Date.now() - 24 * 60 * 60 * 1000) })
        .andWhere('transaction.metadata IS NULL OR transaction.metadata->>\'retryCount\' IS NULL OR (metadata->>\'retryCount\')::int < 3')
        .getMany();

      let retryCount = 0;
      for (const transaction of retryableFailures) {
        try {
          const currentRetryCount = parseInt(transaction.metadata?.retryCount || '0');

          if (currentRetryCount < 3) {
            const newMetadata = {
              ...transaction.metadata,
              retryCount: currentRetryCount + 1,
              lastRetryAt: new Date().toISOString()
            };

            await transactionRepository.update(transaction.id, {
              status: 'pending',
              metadata: newMetadata
            });

            console.log(`🔄 Queued transaction ${transaction.id} for retry (attempt ${currentRetryCount + 1})`);
            retryCount++;
          }
        } catch (error) {
          console.error(`❌ Error retrying transaction ${transaction.id}:`, error);
        }
      }

      console.log(`🎉 Queued ${retryCount} transactions for retry`);
      return retryCount;
    } catch (error) {
      console.error('❌ Error in failed payment retry job:', error);
      throw error;
    }
  }

  /**
   * Pre-warm the exchange rate cache for all supported currencies.
   * Runs every 4 hours so wallet requests never hit an external API.
   */
  static async updateCurrencyRates() {
    try {
      console.log('🔄 Pre-warming exchange rate cache...');

      const paymentService = require('../services/paymentService');

      // All currencies used in the platform
      const targetCurrencies = [
        'NGN', 'GHS', 'ZAR', 'KES', 'XOF', 'EGP', 'XAF',
        'EUR', 'GBP', 'UGX', 'TZS', 'SLL', 'MWK', 'ZMW', 'RWF', 'CAD', 'AUD'
      ];

      let updatedCount = 0;

      // Fetch all rates from USD base in one request and warm cache for each pair
      try {
        const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
        const rates = response.data.rates;

        for (const currency of targetCurrencies) {
          if (rates[currency]) {
            paymentService.warmExchangeRateCache('USD', currency, rates[currency]);
            // Also cache inverse (currency → USD) for any reverse lookups
            paymentService.warmExchangeRateCache(currency, 'USD', 1 / rates[currency]);
            updatedCount++;
          }
        }

        console.log(`✅ Warmed cache for ${updatedCount} currency pairs from USD base`);
      } catch (error) {
        console.error('❌ Failed to fetch USD base rates:', error);
      }

      console.log(`🎉 Exchange rate cache pre-warmed (${updatedCount} pairs)`);
      return updatedCount;
    } catch (error) {
      console.error('❌ Error updating currency rates:', error);
      throw error;
    }
  }

  /**
   * Process pending withdrawals
   */
  static async processPendingWithdrawals() {
    try {
      console.log('🔄 Processing pending withdrawals...');

      const pendingWithdrawals = await walletWithdrawalRepository.findPendingWithdrawals();
      let processedCount = 0;

      for (const withdrawal of pendingWithdrawals) {
        try {
          const result = await walletService.processBankWithdrawal(withdrawal);

          if (result.success) {
            await walletWithdrawalRepository.markAsProcessing(withdrawal.id, result.reference);
            console.log(`✅ Processing withdrawal ${withdrawal.id}`);
            processedCount++;
          } else {
            await walletWithdrawalRepository.markAsFailed(withdrawal.id, result.error);
            console.log(`❌ Failed withdrawal ${withdrawal.id}: ${result.error}`);
          }
        } catch (error) {
          console.error(`❌ Error processing withdrawal ${withdrawal.id}:`, error);
          await walletWithdrawalRepository.markAsFailed(withdrawal.id, error.message);
        }
      }

      console.log(`🎉 Processed ${processedCount} pending withdrawals`);
      return processedCount;
    } catch (error) {
      console.error('❌ Error processing withdrawals:', error);
      throw error;
    }
  }

  /**
   * Cleanup old transaction data
   */
  static async cleanupOldData() {
    try {
      console.log('🔄 Cleaning up old transaction data...');

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      const result = await transactionRepository.createQueryBuilder()
        .delete()
        .where('status = :status', { status: 'failed' })
        .andWhere('failedAt < :date', { date: ninetyDaysAgo })
        .execute();

      console.log(`✅ Cleaned up ${result.affected} old transactions`);
      return result.affected;
    } catch (error) {
      console.error('❌ Error cleaning up old data:', error);
      throw error;
    }
  }
}

module.exports = PaymentJobs;