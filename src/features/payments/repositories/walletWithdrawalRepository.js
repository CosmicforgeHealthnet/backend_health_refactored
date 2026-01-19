// src/repositories/walletWithdrawalRepository.js
const AppDataSource = require('../../../config/database');
const WalletWithdrawal = require('../../payments/entities/WalletWithdrawal');

class WalletWithdrawalRepository {
    constructor() {
        this.repo = AppDataSource.getRepository(WalletWithdrawal);
    }

    create(data) {
        return this.repo.create(data);
    }

    save(withdrawal) {
        return this.repo.save(withdrawal);
    }

    findById(id) {
        return this.repo.findOne({
            where: { id },
            relations: ['wallet', 'doctor']
        });
    }

    findByDoctorId(doctorId) {
        return this.repo.find({
            where: { doctorId },
            order: { createdAt: 'DESC' }
        });
    }

    findByWalletId(walletId) {
        return this.repo.find({
            where: { walletId },
            order: { createdAt: 'DESC' }
        });
    }

    findPendingWithdrawals() {
        return this.repo.find({
            where: { status: 'pending' },
            order: { createdAt: 'ASC' },
            relations: ['wallet', 'doctor']
        });
    }

    updateStatus(id, status, additionalData = {}) {
        return this.repo.update(id, {
            status,
            ...additionalData,
            processedAt: ['processing', 'completed', 'failed'].includes(status) ? new Date() : undefined,
            completedAt: status === 'completed' ? new Date() : undefined
        });
    }

    // REPLACE the existing Paystack OTP methods with these custom OTP methods:

    /**
     * Update withdrawal with custom OTP details
     */
    updateOtpDetails(id, otpCode, expiresAt) {
        return this.repo.update(id, {
            otpCode,
            otpExpiresAt: expiresAt,
            otpAttempts: 0,
            isOtpVerified: false,
            status: 'pending_otp',
            updatedAt: new Date()
        });
    }

    /**
     * Increment OTP attempts counter
     */
    incrementOtpAttempts(id) {
        return this.repo.increment({ id }, 'otpAttempts', 1);
    }

    /**
     * Mark OTP as verified and update status
     */
    markOtpAsVerified(id) {
        return this.repo.update(id, {
            isOtpVerified: true,
            status: 'processing',
            processedAt: new Date(),
            updatedAt: new Date()
        });
    }

    /**
     * Find withdrawal with OTP details for verification
     */
    findWithOtpDetails(id) {
        return this.repo.findOne({
            where: { id },
            select: ['id', 'doctorId', 'otpCode', 'otpExpiresAt', 'otpAttempts', 'isOtpVerified', 'status', 'maxOtpAttempts'],
            relations: ['doctor'] // Include doctor for email sending
        });
    }

    /**
     * Reset OTP details (for resend functionality)
     */
    resetOtpDetails(id, newOtpCode, newExpiresAt) {
        return this.repo.update(id, {
            otpCode: newOtpCode,
            otpExpiresAt: newExpiresAt,
            otpAttempts: 0,
            isOtpVerified: false,
            updatedAt: new Date()
        });
    }

    /**
     * Block withdrawal due to too many OTP attempts
     */
    blockWithdrawalOtp(id, reason = 'Maximum OTP attempts exceeded') {
        return this.repo.update(id, {
            status: 'blocked',
            failureReason: reason,
            processedAt: new Date(),
            updatedAt: new Date()
        });
    }

    /**
     * Find all pending OTP withdrawals for cleanup job
     */
    findExpiredOtpWithdrawals() {
        return this.repo.createQueryBuilder('withdrawal')
            .where('withdrawal.status = :status', { status: 'pending_otp' })
            .andWhere('withdrawal.otpExpiresAt < :now', { now: new Date() })
            .getMany();
    }


    updateParentWithdrawalId(id, parentId) {
        return this.repo.update(id, { parentWithdrawalId: parentId });
    }

    markAsProcessing(id, providerReference) {
        return this.repo.update(id, {
            status: 'processing',
            providerReference,
            processedAt: new Date()
        });
    }

    markAsCompleted(id) {
        return this.repo.update(id, {
            status: 'completed',
            completedAt: new Date()
        });
    }

    markAsFailed(id, reason) {
        return this.repo.update(id, {
            status: 'failed',
            failureReason: reason,
            processedAt: new Date()
        });
    }
}

module.exports = new WalletWithdrawalRepository();
