
const AppDataSource = require('../src/config/database');
const pharmacyRegistrationService = require('../src/features/pharmacy/services/pharmacyRegistrationService');
const userRepo = require('../src/features/auth/repositories/userRepository');

async function verifyAll() {
    try {
        console.log('🔄 Initializing DB...');
        await AppDataSource.initialize();
        console.log('✅ DB Connected.');

        const timestamp = Date.now();
        const testEmail = `verify_all_${timestamp}@example.com`;
        const testUsername = `user_${timestamp}`;

        // 1. REGISTRATION
        console.log(`\n--- STEP 1: REGISTRATION (${testEmail}) ---`);
        const regData = {
            fullName: "E2E Master Owner",
            email: testEmail,
            password: "Password123!",
            pharmacyName: "E2E Master Pharmacy",
            registrationNumber: `REG-${timestamp}`,
            address: "Infinity Loop, Silicon Valley",
            phone: "09000000000",
            primaryContactPerson: "Master Owner",
            preferredUsername: testUsername
        };
        const regResult = await pharmacyRegistrationService.registerPharmacy(regData);
        console.log('✅ Registration SUCCESS');
        const userId = regResult.user.id;

        // 2. SETTINGS & PRICING
        console.log('\n--- STEP 2: SETTINGS & PRICING ---');
        const profileUpdate = {
            serviceRadius: 50,
            defaultCurrency: 'USD',
            notificationPreferences: { email: true, push: true }
        };
        await pharmacyRegistrationService.updatePharmacyProfile(userId, profileUpdate);
        console.log('✅ Profile updated (Radius: 50)');

        const pricingData = { feeType: 'consultation', price: 25.0, currency: 'USD' };
        await pharmacyRegistrationService.setPricing(userId, pricingData);
        const pricing = await pharmacyRegistrationService.getPricing(userId);
        console.log('✅ Pricing verified:', pricing.length, 'entries');

        // 3. STAFF MANAGEMENT
        console.log('\n--- STEP 3: STAFF MANAGEMENT ---');
        const staffData = {
            fullName: 'Jane Pharmacist',
            email: `staff_${timestamp}@example.com`,
            password: 'StaffPassword123!',
            role: 'pharmacist'
        };
        const staffMember = await pharmacyRegistrationService.addStaffMember(userId, staffData);
        console.log('✅ Staff member added:', staffMember.email);

        const staffList = await pharmacyRegistrationService.getStaffMembers(userId);
        console.log('✅ Staff list count:', staffList.length);

        console.log('\n--- STEP 4: CLEANUP (DISSOCIATE STAFF) ---');
        await pharmacyRegistrationService.removeStaffMember(userId, staffMember.id);
        const finalStaffList = await pharmacyRegistrationService.getStaffMembers(userId);
        console.log('✅ Staff removed. Final count:', finalStaffList.length);

        await AppDataSource.destroy();
        console.log('\n🏁 ALL PHARMACY WORKFLOWS VERIFIED SUCCESSFULLY.');
    } catch (e) {
        console.error('\n❌ VERIFICATION FAILED:', e.message);
        if (e.stack) console.error(e.stack);
        process.exit(1);
    }
}

verifyAll();
