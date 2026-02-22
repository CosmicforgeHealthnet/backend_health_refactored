const AppDataSource = require('../src/config/database');
const pharmacyRegistrationService = require('../src/features/pharmacy/services/pharmacyRegistrationService');

async function testService() {
    try {
        await AppDataSource.initialize();
        console.log('✅ DB Connected.');

        const registrationData = {
            fullName: "Test Owner",
            email: `service_test_${Date.now()}@example.com`,
            password: "Password123!",
            pharmacyName: "Service Test Pharmacy",
            registrationNumber: `SRV-${Date.now()}`,
            address: "123 Test St",
            phone: "08012345678",
            primaryContactPerson: "Test Owner",
            preferredUsername: `srvtest_${Date.now()}`
        };

        console.log('🔄 Calling registerPharmacy...');
        const result = await pharmacyRegistrationService.registerPharmacy(registrationData);
        console.log('✅ Registration SUCCESS:', JSON.stringify(result, null, 2));

        await AppDataSource.destroy();
    } catch (e) {
        console.error('❌ SERVICE ERROR:', e);
        // Print stack trace for better debugging
        console.error(e.stack);
        process.exit(1);
    }
}

testService();
