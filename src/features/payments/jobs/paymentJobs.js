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
   * Update currency exchange rates
   */
  static async updateCurrencyRates() {
    try {
      console.log('🔄 Updating currency rates...');

      const baseCurrencies = ['USD', 'NGN', 'GHS', 'EUR', 'GBP'];
      let updatedCount = 0;

      for (const currency of baseCurrencies) {
        try {
          const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${currency}`);
          console.log(`✅ Updated rates for ${currency}`);
          updatedCount++;
        } catch (error) {
          console.error(`❌ Failed to update rates for ${currency}:`, error);
        }
      }

      console.log(`🎉 Updated ${updatedCount} currency rates successfully`);
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