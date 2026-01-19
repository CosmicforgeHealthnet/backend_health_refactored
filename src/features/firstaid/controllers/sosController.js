// src/controllers/sosController.js
const SOSService = require('../services/sosService');

class SOSController {
    static async getEmergencyNumbers(req, res) {
        try {
            const { includeTips, emergencyType } = req.query;
            const includesTips = includeTips === 'true';
            const type = emergencyType || 'general';

            const emergencyInfo = SOSService.getEmergencyInfo(
                req.location,
                includesTips,
                type
            );

            res.status(200).json({
                ...emergencyInfo,
                locationData: req.location,
            });
        } catch (error) {
            console.error('Error in getEmergencyNumbers:', error);
            res.status(500).json({ success: false, error: 'Failed to retrieve emergency information' });
        }
    }

    static async getEmergencyNumbersByCountry(req, res) {
        try {
            const { countryCode, countryName, includeTips, emergencyType } = req.query;
            const includesTips = includeTips === 'true';
            const type = emergencyType || 'general';

            let location = {};
            if (countryCode) {
                location = { countryCode: countryCode.toUpperCase(), country: countryCode, city: 'Unknown' };
            } else if (countryName) {
                location = { country: countryName, countryCode: 'Unknown', city: 'Unknown' };
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Provide either countryCode or countryName',
                });
            }

            const emergencyInfo = SOSService.getEmergencyInfo(location, includesTips, type);
            res.status(200).json(emergencyInfo);
        } catch (error) {
            console.error('Error in getEmergencyNumbersByCountry:', error);
            res.status(500).json({ success: false, error: 'Failed to retrieve emergency information' });
        }
    }

    static async getEmergencyByType(req, res) {
        try {
            const { type } = req.params;
            const validTypes = ['police', 'fire', 'medical', 'general'];

            if (!type || typeof type !== 'string' || type.trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'Emergency type is required in the URL path',
                    example: '/api/sos/emergency/police'
                });
            }

            const normalizedType = type.toLowerCase().trim();

            if (!validTypes.includes(normalizedType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid emergency type. Valid: ${validTypes.join(', ')}`,
                    received: type
                });
            }

            const emergencyInfo = SOSService.getEmergencyInfoByType(req.location, normalizedType);

            res.status(200).json({
                ...emergencyInfo,
                emergencyType: normalizedType,
                locationData: req.location,
            });
        } catch (error) {
            console.error('Error in getEmergencyByType:', error);
            res.status(500).json({ success: false, error: 'Failed to retrieve emergency information' });
        }
    }

    static async getAllSafetyTips(req, res) {
        try {
            const allSafetyTips = SOSService.getAllSafetyTips();

            res.status(200).json({
                success: true,
                safetyTips: allSafetyTips,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error in getAllSafetyTips:', error);
            res.status(500).json({ success: false, error: 'Failed to retrieve safety tips' });
        }
    }

    static async getSafetyTips(req, res) {
        try {
            const { type } = req.params;
            const validTypes = ['police', 'fire', 'medical', 'general'];

            if (!type || typeof type !== 'string' || type.trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'Emergency type is required in the URL path',
                    example: '/api/sos/safety-tips/police'
                });
            }

            const normalizedType = type.toLowerCase().trim();

            if (!validTypes.includes(normalizedType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid emergency type. Valid: ${validTypes.join(', ')}`,
                    received: type
                });
            }

            const safetyTips = SOSService.getSafetyTips(normalizedType);

            res.status(200).json({
                success: true,
                emergencyType: normalizedType,
                safetyTips,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error in getSafetyTips:', error);
            res.status(500).json({ success: false, error: 'Failed to retrieve safety tips' });
        }
    }

    static async getSpecificService(req, res) {
        try {
            const { type } = req.params;
            const validServices = ['police', 'fire', 'medical'];

            if (!type || typeof type !== 'string' || type.trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'Service type is required in the URL path',
                    example: '/api/sos/service/police'
                });
            }

            const normalizedType = type.toLowerCase().trim();

            if (!validServices.includes(normalizedType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid service type. Valid: ${validServices.join(', ')}`,
                    received: type
                });
            }

            const emergencyInfo = SOSService.getEmergencyInfoByType(req.location, normalizedType);
            const serviceNumber = emergencyInfo.emergency.numbers
                ? emergencyInfo.emergency.numbers[normalizedType]
                : emergencyInfo.emergency.number;

            res.status(200).json({
                ...emergencyInfo,
                serviceType: normalizedType,
                serviceNumber,
                quickCall: {
                    message: `For ${normalizedType} emergency, call: ${serviceNumber}`,
                    number: serviceNumber,
                },
                locationData: req.location,
            });
        } catch (error) {
            console.error('Error in getSpecificService:', error);
            res.status(500).json({ success: false, error: 'Failed to retrieve service information' });
        }
    }
}

module.exports = SOSController;
