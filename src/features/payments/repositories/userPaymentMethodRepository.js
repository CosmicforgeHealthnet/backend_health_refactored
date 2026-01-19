// src/repositories/userPaymentMethodRepository.js
const AppDataSource = require('../../../config/database');
const UserPaymentMethod = require('../../payments/entities/UserPaymentMethod');

class UserPaymentMethodRepository {
    constructor() {
        this.repo = AppDataSource.getRepository(UserPaymentMethod);
    }

    create(data) {
        return this.repo.create(data);
    }

    save(paymentMethod) {
        return this.repo.save(paymentMethod);
    }

    findById(id) {
        return this.repo.findOne({ where: { id } });
    }

    findByUserId(userId) {
        return this.repo.find({
            where: { userId, isActive: true },
            order: { lastUsedAt: 'DESC' }
        });
    }

    findByCardLast4(userId, cardLast4) {
        return this.repo.findOne({
            where: { userId, cardLast4, isActive: true }
        });
    }

    findUserDefault(userId) {
        return this.repo.findOne({
            where: { userId, isDefault: true, isActive: true }
        });
    }

    /**
   * Find payment methods available for auto-billing
   */
    findForAutoBilling(userId) {
        return this.repo.find({
            where: {
                userId,
                isActive: true,
                canAutoCharge: true
            },
            order: {
                autoBillingSuccessCount: 'DESC',
                lastAutoBillingUse: 'DESC'
            }
        });
    }

    /**
     * Update auto-billing success/failure
     */
    async updateAutoBillingResult(id, wasSuccessful) {
        const updateData = {
            lastAutoBillingUse: new Date(),
            updatedAt: new Date()
        };

        if (wasSuccessful) {
            await this.repo.increment({ id }, 'autoBillingSuccessCount', 1);
            updateData.autoBillingFailureCount = 0; // Reset failures on success
        } else {
            await this.repo.increment({ id }, 'autoBillingFailureCount', 1);
        }

        return this.repo.update(id, updateData);
    }

    /**
     * Disable auto-charging for payment method
     */
    async disableAutoCharging(id) {
        return this.repo.update(id, {
            canAutoCharge: false,
            updatedAt: new Date()
        });
    }

    /**
     * Update token expiry date
     */
    async updateTokenExpiry(id, expiryDate) {
        return this.repo.update(id, {
            tokenExpiryDate: expiryDate,
            updatedAt: new Date()
        });
    }

    /**
     * Find expiring tokens
     */
    findExpiringTokens(daysBefore = 30) {
        const expiryDate = new Date(Date.now() + daysBefore * 24 * 60 * 60 * 1000);

        return this.repo.find({
            where: {
                isActive: true,
                canAutoCharge: true,
                tokenExpiryDate: AppDataSource.createQueryBuilder()
                    .select('tokenExpiryDate')
                    .where('tokenExpiryDate <= :expiryDate', { expiryDate })
                    .andWhere('tokenExpiryDate IS NOT NULL')
            },
            relations: ['user']
        });
    }

    /**
     * Get best payment method for auto-billing
     */
    async getBestForAutoBilling(userId) {
        return this.repo.findOne({
            where: {
                userId,
                isActive: true,
                canAutoCharge: true
            },
            order: {
                isDefault: 'DESC',
                autoBillingSuccessCount: 'DESC',
                lastAutoBillingUse: 'DESC'
            }
        });
    }

    updateSuccessRate(id, provider, wasSuccessful) {
        const providerField = provider === 'flutterwave' ? 'flutterwave' : 'paystack';

        return this.repo.increment(
            { id },
            `${providerField}AttemptCount`,
            1
        ).then(() => {
            if (wasSuccessful) {
                return this.repo.increment(
                    { id },
                    `${providerField}SuccessCount`,
                    1
                );
            }
        });
    }

    updateLastUsed(id, provider) {
        return this.repo.update(id, {
            lastUsedAt: new Date(),
            lastSuccessfulProvider: provider
        });
    }

    setDefault(userId, paymentMethodId) {
        // First unset all defaults for user
        return this.repo.update(
            { userId },
            { isDefault: false }
        ).then(() => {
            // Then set the new default
            return this.repo.update(paymentMethodId, { isDefault: true });
        });
    }
}

module.exports = new UserPaymentMethodRepository();
