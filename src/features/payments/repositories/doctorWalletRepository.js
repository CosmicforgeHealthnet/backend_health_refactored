// src/repositories/doctorWalletRepository.js
const AppDataSource = require('../../../config/database');
const DoctorWallet = require('../entities/DoctorWallet');
const { MoreThan } = require('typeorm'); // ADD this import at top

class DoctorWalletRepository {
    constructor() {
        this.repo = AppDataSource.getRepository(DoctorWallet);
    }

    create(data) {
        return this.repo.create(data);
    }

    save(wallet) {
        return this.repo.save(wallet);
    }

    findByDoctorId(doctorId) {
        return this.repo.findOne({
            where: { doctorId },
            relations: ['doctor']
        });
    }

    addAvailableBalance(doctorId, amountUsd) {
        return this.repo.increment(
            { doctorId },
            'availableBalanceUsd',
            amountUsd
        ).then(() => {
            return this.repo.increment(
                { doctorId },
                'totalBalanceUsd',
                amountUsd
            );
        });
    }

    // ADD these methods to your existing DoctorWalletRepository class:

    /**
     * Set wallet password for a doctor
     */
    async setWalletPassword(doctorId, hashedPassword) {
        return this.repo.update(
            { doctorId },
            {
                walletPassword: hashedPassword,
                updatedAt: new Date()
            }
        );
    }

    /**
   * Store wallet password reset token
   */
    async storeWalletPasswordResetToken(doctorId, token, expiresAt) {
        return this.repo.update(
            { doctorId },
            {
                walletPasswordResetToken: token,
                walletPasswordResetExpiresAt: expiresAt,
                walletPasswordResetAttempts: 0,
                updatedAt: new Date()
            }
        );
    }

    /**
     * Find wallet by reset token
     */
    async findByWalletPasswordResetToken(token) {
        return this.repo.findOne({
            where: {
                walletPasswordResetToken: token,
                walletPasswordResetExpiresAt: MoreThan(new Date()) // Token not expired
            },
            relations: ['doctor'],
            select: ['id', 'doctorId', 'walletPasswordResetToken', 'walletPasswordResetExpiresAt', 'walletPasswordResetAttempts']
        });
    }

    /**
     * Increment password reset attempts
     */
    async incrementPasswordResetAttempts(doctorId) {
        return this.repo.increment(
            { doctorId },
            'walletPasswordResetAttempts',
            1
        );
    }

    /**
     * Reset wallet password using token
     */
    async resetWalletPasswordWithToken(token, hashedNewPassword) {
        const wallet = await this.findByWalletPasswordResetToken(token);

        if (!wallet) {
            throw new Error('Invalid or expired reset token');
        }

        if (wallet.walletPasswordResetAttempts >= 3) {
            throw new Error('Too many reset attempts. Please request a new reset link.');
        }

        // Update password and clear reset token
        return this.repo.update(
            { id: wallet.id },
            {
                walletPassword: hashedNewPassword,
                walletPasswordResetToken: null,
                walletPasswordResetExpiresAt: null,
                walletPasswordResetAttempts: 0,
                updatedAt: new Date()
            }
        );
    }

    /**
     * Clear wallet password reset token (after successful reset or expiry)
     */
    async clearWalletPasswordResetToken(doctorId) {
        return this.repo.update(
            { doctorId },
            {
                walletPasswordResetToken: null,
                walletPasswordResetExpiresAt: null,
                walletPasswordResetAttempts: 0,
                updatedAt: new Date()
            }
        );
    }

    /**
     * Check if doctor has too many reset attempts
     */
    async hasExceededResetAttempts(doctorId) {
        const wallet = await this.repo.findOne({
            where: { doctorId },
            select: ['walletPasswordResetAttempts']
        });

        return (wallet?.walletPasswordResetAttempts || 0) >= 3;
    }

    /**
     * Find wallet password for verification
     */
    async findWalletPassword(doctorId) {
        return this.repo.findOne({
            where: { doctorId },
            select: ['id', 'doctorId', 'walletPassword']
        });
    }

    /**
     * Check if doctor has set a wallet password
     */
    async hasWalletPassword(doctorId) {
        const wallet = await this.repo.findOne({
            where: { doctorId },
            select: ['walletPassword']
        });
        return !!(wallet?.walletPassword);
    }

    /**
     * Update wallet password
     */
    async updateWalletPassword(doctorId, hashedPassword) {
        const updateResult = await this.repo.update(
            { doctorId },
            {
                walletPassword: hashedPassword,
                updatedAt: new Date()
            }
        );

        if (updateResult.affected === 0) {
            throw new Error('Wallet not found');
        }

        return updateResult;
    }

    findById(id) {
        return this.repo.findOne({
            where: { id },
            relations: ['doctor']
        });
    }

    addPendingCredits(doctorId, amountUsd) {
        return this.repo.increment(
            { doctorId },
            'pendingCreditsUsd',
            amountUsd
        ).then(() => {
            return this.repo.increment(
                { doctorId },
                'totalBalanceUsd',
                amountUsd
            );
        });
    }

    removePendingCredits(doctorId, amountUsd) {
        return this.repo.decrement(
            { doctorId },
            'pendingCreditsUsd',
            amountUsd
        ).then(() => {
            return this.repo.decrement(
                { doctorId },
                'totalBalanceUsd',
                amountUsd
            );
        });
    }

    releasePendingCredits(doctorId, amountUsd) {
        return this.repo.decrement(
            { doctorId },
            'pendingCreditsUsd',
            amountUsd
        ).then(() => {
            return this.repo.increment(
                { doctorId },
                'availableBalanceUsd',
                amountUsd
            );
        });
    }

    deductAvailableBalance(doctorId, amountUsd) {
        return this.repo.decrement(
            { doctorId },
            'availableBalanceUsd',
            amountUsd
        ).then(() => {
            return this.repo.decrement(
                { doctorId },
                'totalBalanceUsd',
                amountUsd
            );
        });
    }

    updateParentWithdrawalId(withdrawalId, parentId) {
        return this.repo.update(withdrawalId, {
            parentWithdrawalId: parentId
        });
    }

    findByDoctorIdWithProcessor(doctorId, processor) {
        return this.repo.find({
            where: {
                doctorId,
                processor
            },
            relations: ['doctor'],
            order: { createdAt: 'DESC' }
        });
    }

    // 🔧 FIXED: Use proper WHERE criteria for update
    updateDisplayCurrency(doctorId, currency) {
        return this.repo.update(
            { doctorId }, // ← This should be an object with WHERE criteria
            {
                preferredDisplayCurrency: currency
            }
        );
    }

    // 🔧 FIXED: Use proper WHERE criteria for freeze operations
    freezeWallet(doctorId, reason) {
        return this.repo.update(
            { doctorId }, // ← Fixed: Use WHERE criteria object
            {
                isFrozen: true,
                frozenReason: reason
            }
        );
    }

    // 🔧 FIXED: Use proper WHERE criteria for unfreeze operations
    unfreezeWallet(doctorId) {
        return this.repo.update(
            { doctorId }, // ← Fixed: Use WHERE criteria object
            {
                isFrozen: false,
                frozenReason: null
            }
        );
    }

    // 🔧 ALTERNATIVE: More explicit update method using find + save
    async updateDisplayCurrencyExplicit(doctorId, currency) {
        try {
            const wallet = await this.findByDoctorId(doctorId);
            if (!wallet) {
                throw new Error('Wallet not found');
            }

            wallet.preferredDisplayCurrency = currency;
            return await this.save(wallet);
        } catch (error) {
            console.error('Error updating display currency:', error);
            throw error;
        }
    }

    // 🔧 BONUS: Verify update was successful
    async updateDisplayCurrencyWithVerification(doctorId, currency) {
        try {
            const updateResult = await this.repo.update(
                { doctorId },
                { preferredDisplayCurrency: currency }
            );

            // Check if the update affected any rows
            if (updateResult.affected === 0) {
                throw new Error('No wallet found to update');
            }

            // Return the updated wallet
            return await this.findByDoctorId(doctorId);
        } catch (error) {
            console.error('Error updating display currency:', error);
            throw error;
        }
    }
}

module.exports = new DoctorWalletRepository();
