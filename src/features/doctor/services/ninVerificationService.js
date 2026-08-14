// src/features/doctor/services/ninVerificationService.js
//
// NIN (National Identification Number) identity verification for Nigerian doctors.
// NIMC does not expose a public API, so this goes through a licensed third-party
// KYC provider (Dojah by default). The provider returns the government-registered
// name for the NIN; matching that name against the doctor's platform name is our
// responsibility, not the provider's.
//
// IMPORTANT: the exact request/response contract below (endpoint, headers, field
// names) must be confirmed against the chosen provider's current API docs before
// this is used against a live key — provider APIs change and this has not been
// tested against a real account.

const axios = require('axios');
const config = require('../../../config/verificationConfig');
const { NinVerificationStatus } = require('../entities/VerificationRequest');

class NinVerificationService {

    /**
     * Verify a NIN and check whether the government-registered name matches the
     * name the doctor is registered under on the platform.
     * @param {string} nin - 11-digit National Identification Number
     * @param {string} platformFullName - the doctor's full name as registered on the platform
     */
    async verifyNin(nin, platformFullName) {
        const ninConfig = config.NIN_VERIFICATION;

        if (!nin || !/^\d{11}$/.test(nin)) {
            return {
                status: NinVerificationStatus.FAILED,
                error: `NIN must be exactly ${ninConfig.NIN_LENGTH} digits`,
                providerData: null,
                nameMatchScore: null
            };
        }

        let providerResult;
        try {
            switch (ninConfig.PROVIDER) {
                case 'dojah':
                    providerResult = await this.verifyViaDojah(nin);
                    break;
                default:
                    throw new Error(`No NIN provider handler for: ${ninConfig.PROVIDER}`);
            }
        } catch (error) {
            console.error('NIN provider lookup failed:', error.message);
            return {
                status: NinVerificationStatus.FAILED,
                error: error.message,
                providerData: null,
                nameMatchScore: null
            };
        }

        if (!providerResult || !providerResult.success) {
            return {
                status: NinVerificationStatus.FAILED,
                error: providerResult?.error || 'NIN could not be verified',
                providerData: providerResult?.raw || null,
                nameMatchScore: null
            };
        }

        const registeredName = [providerResult.firstName, providerResult.middleName, providerResult.lastName]
            .filter(Boolean)
            .join(' ');

        const nameMatchScore = Math.round(
            this.calculateNameSimilarity(registeredName, platformFullName) * 100
        );

        const matched = nameMatchScore >= ninConfig.NAME_MATCH_THRESHOLD;

        return {
            status: matched ? NinVerificationStatus.VERIFIED : NinVerificationStatus.MISMATCH,
            error: null,
            providerData: {
                firstName: providerResult.firstName,
                middleName: providerResult.middleName,
                lastName: providerResult.lastName,
                registeredName,
                gender: providerResult.gender,
                dateOfBirth: providerResult.dateOfBirth,
                phoneNumber: providerResult.phoneNumber
            },
            nameMatchScore
        };
    }

    /**
     * Dojah NIN lookup.
     * Docs: https://docs.dojah.io (confirm exact header/param names before going live)
     */
    async verifyViaDojah(nin) {
        const providerConfig = config.NIN_VERIFICATION.PROVIDERS.dojah;
        const appId = process.env[providerConfig.appIdEnv];
        const secretKey = process.env[providerConfig.secretKeyEnv];

        if (!appId || !secretKey) {
            throw new Error('Dojah credentials not configured (DOJAH_APP_ID / DOJAH_SECRET_KEY)');
        }

        const response = await axios.get(providerConfig.endpoint, {
            params: { nin },
            headers: {
                'AppId': appId,
                'Authorization': secretKey
            },
            timeout: 30000
        });

        const entity = response.data?.entity;
        if (!entity) {
            return { success: false, error: 'No matching NIN record found', raw: response.data };
        }

        return {
            success: true,
            firstName: entity.first_name,
            middleName: entity.middle_name,
            lastName: entity.last_name || entity.surname,
            gender: entity.gender,
            dateOfBirth: entity.date_of_birth || entity.dob,
            phoneNumber: entity.phone_number,
            raw: response.data
        };
    }

    /**
     * Similarity between two names, normalized to 0-1.
     * Tolerant of word order and case (government records aren't always in the
     * same first/middle/last order the doctor typed on the platform).
     */
    calculateNameSimilarity(nameA, nameB) {
        const normalize = (name) => name
            .toLowerCase()
            .replace(/[^a-z\s]/g, '')
            .split(/\s+/)
            .filter(Boolean)
            .sort()
            .join(' ');

        const a = normalize(nameA || '');
        const b = normalize(nameB || '');

        if (!a || !b) return 0;
        if (a === b) return 1;

        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;
        const editDistance = this.levenshteinDistance(longer, shorter);

        return (longer.length - editDistance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + substitutionCost
                );
            }
        }

        return matrix[str2.length][str1.length];
    }
}

module.exports = new NinVerificationService();
