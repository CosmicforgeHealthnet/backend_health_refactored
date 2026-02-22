
const AppDataSource = require('../src/config/database');
const pharmacyRegistrationService = require('../src/features/pharmacy/services/pharmacyRegistrationService');
const userRepo = require('../src/features/auth/repositories/userRepository');

async function testSettings() {
    try {
        console.log('🔄 Initializing DB...');
        await AppDataSource.initialize();
        console.log('✅ DB Connected.');

        const email = 'service_test@example.com';
        console.log('🔍 DEBUG - userRepo type:', typeof userRepo);
        console.log('🔍 DEBUG - userRepo methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(userRepo)));
        console.log('🔍 DEBUG - userRepo instance keys:', Object.keys(userRepo));
        const user = await userRepo.findByEmail(email);
        if (!user) {
            throw new Error(`User ${email} not found. Run registration test first.`);
        }
        const userId = user.id;
        console.log(`👤 Using user ID: ${userId}`);

        // 1. Update Profile
        console.log('🔄 Updating profile...');
        const profileUpdate = {
            serviceRadius: 25,
            defaultCurrency: 'USD',
            notificationPreferences: { email: true, sms: false }
        };
        const updatedProfile = await pharmacyRegistrationService.updatePharmacyProfile(userId, profileUpdate);
        console.log('✅ Profile updated:', JSON.stringify(updatedProfile, null, 2));

        // 2. Set Pricing
        console.log('🔄 Setting pricing...');
        const pricingData = {
            feeType: 'delivery',
            price: 15.50,
            currency: 'USD'
        };
        const pricingResult = await pharmacyRegistrationService.setPricing(userId, pricingData);
        console.log('✅ Pricing set:', JSON.stringify(pricingResult, null, 2));

        // 3. Get Pricing
        console.log('🔄 Fetching pricing...');
        const allPricing = await pharmacyRegistrationService.getPricing(userId);
        console.log('✅ Current pricing:', JSON.stringify(allPricing, null, 2));

        await AppDataSource.destroy();
        console.log('🏁 Settings verification DONE.');
    } catch (e) {
        const util = require('util');
        console.error('❌ SETTINGS ERROR inspect:', util.inspect(e, { showHidden: true, depth: null }));
        if (e.stack) console.error('Stack:', e.stack);
        process.exit(1);
    }
}

testSettings();
