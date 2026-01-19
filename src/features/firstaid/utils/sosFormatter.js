// src/features/firstaid/utils/sosFormatter.js

const formatEmergencyMessage = (emergencyInfo, includeSafetyTips = false, emergencyType = 'general') => {
    const { location, numbers, safetyTips } = emergencyInfo;

    let message = `EMERGENCY ALERT\n`;
    message += `Location: ${location.city}, ${location.country}\n`;

    if (numbers) {
        message += `\nEmergency Numbers:\n`;
        if (numbers.police) message += `Police: ${numbers.police}\n`;
        if (numbers.ambulance) message += `Ambulance: ${numbers.ambulance}\n`;
        if (numbers.fire) message += `Fire: ${numbers.fire}\n`;
        if (numbers.general) message += `General: ${numbers.general}\n`;
    }

    if (includeSafetyTips && safetyTips) {
        message += `\nSafety Tips (${emergencyType}):\n`;
        safetyTips.forEach(tip => {
            message += `- ${tip}\n`;
        });
    }

    return message;
};

const formatSpecificEmergencyMessage = (emergencyInfo, emergencyType, specificNumber, safetyTips) => {
    const { location } = emergencyInfo;

    let message = `EMERGENCY ALERT: ${emergencyType.toUpperCase()}\n`;
    message += `Location: ${location.city}, ${location.country}\n`;
    message += `Dial: ${specificNumber}\n`;

    if (safetyTips) {
        message += `\nSafety Tips:\n`;
        safetyTips.forEach(tip => {
            message += `- ${tip}\n`;
        });
    }

    return message;
};

module.exports = {
    formatEmergencyMessage,
    formatSpecificEmergencyMessage
};
