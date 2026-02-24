const { emergencyNumbers, countryCodeMap, emergencySafetyTips } = require('../data/repositories/emergencyNumbers');
const { formatEmergencyMessage, formatSpecificEmergencyMessage } = require('../utils/sosFormatter');

class SOSService {
    static getEmergencyNumbers(location) {
        let countryCode = 'DEFAULT';

        if (location && location.countryCode && location.countryCode !== 'Unknown') {
            countryCode = location.countryCode.toUpperCase();
        } else if (location && location.country && location.country !== 'Unknown') {
            const countryName = location.country.toLowerCase();
            countryCode = countryCodeMap[countryName] || 'DEFAULT';
        }

        let numbers = emergencyNumbers[countryCode];
        if (!numbers) {
            numbers = {
                ...emergencyNumbers.DEFAULT,
                notes: `Emergency numbers for ${location?.country || 'this country'} are not in our database. 112 works in most places.`
            };
        }

        return {
            country: location?.country || 'Unknown',
            countryCode,
            city: location?.city || 'Unknown',
            numbers,
            detected: !!location && location.country !== 'Unknown'
        };
    }

    static getSafetyTips(emergencyType = 'general') {
        const validTypes = ['police', 'fire', 'medical', 'general'];
        const type = validTypes.includes(emergencyType.toLowerCase())
            ? emergencyType.toLowerCase()
            : 'general';

        return emergencySafetyTips[type];
    }

    static getEmergencyInfo(location, includeSafetyTips = false, emergencyType = 'general') {
        const emergencyInfo = this.getEmergencyNumbers(location);
        const safetyTips = includeSafetyTips ? this.getSafetyTips(emergencyType) : null;

        return {
            success: true,
            emergency: {
                location: {
                    country: emergencyInfo.country,
                    countryCode: emergencyInfo.countryCode,
                    city: emergencyInfo.city,
                    detected: emergencyInfo.detected
                },
                numbers: emergencyInfo.numbers,
                safetyTips,
                formattedMessage: formatEmergencyMessage(emergencyInfo, includeSafetyTips, emergencyType)
            },
            timestamp: new Date().toISOString()
        };
    }

    static getEmergencyInfoByType(location, emergencyType) {
        const emergencyInfo = this.getEmergencyNumbers(location);
        const safetyTips = this.getSafetyTips(emergencyType);
        const specificNumber = emergencyInfo.numbers[emergencyType];

        return {
            success: true,
            emergency: {
                location: {
                    country: emergencyInfo.country,
                    countryCode: emergencyInfo.countryCode,
                    city: emergencyInfo.city,
                    detected: emergencyInfo.detected
                },
                type: emergencyType,
                number: specificNumber,
                safetyTips,
                formattedMessage: formatSpecificEmergencyMessage(emergencyInfo, emergencyType, specificNumber, safetyTips)
            },
            timestamp: new Date().toISOString()
        };
    }

    static getAllSafetyTips() {
        return emergencySafetyTips;
    }
}

module.exports = SOSService;
