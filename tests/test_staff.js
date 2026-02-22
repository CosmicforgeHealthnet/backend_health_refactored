
const AppDataSource = require('../src/config/database');
const pharmacyRegistrationService = require('../src/features/pharmacy/services/pharmacyRegistrationService');
const userRepo = require('../src/features/auth/repositories/userRepository');

async function testStaff() {
    try {
        console.log('🔄 Initializing DB...');
        await AppDataSource.initialize();
        console.log('✅ DB Connected.');

        const email = 'service_test@example.com';
        console.log('🔍 DEBUG - userRepo type:', typeof userRepo);
        console.log('🔍 DEBUG - userRepo methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(userRepo)));
        const owner = await userRepo.findByEmail(email);
        if (!owner) {
            throw new Error(`Owner ${email} not found. Run registration test first.`);
        }
        const ownerId = owner.id;
        console.log(`👤 Using owner ID: ${ownerId}`);

        // 1. Add Staff Member
        console.log('🔄 Adding staff member...');
        const staffData = {
            fullName: 'John Pharmacist',
            email: 'john_staff@example.com',
            password: 'Password123!',
            role: 'pharmacist'
        };
        const staffResult = await pharmacyRegistrationService.addStaffMember(ownerId, staffData);
        console.log('✅ Staff member added:', JSON.stringify(staffResult, null, 2));

        // 2. List Staff Members
        console.log('🔄 Fetching staff members...');
        const staffList = await pharmacyRegistrationService.getStaffMembers(ownerId);
        console.log('✅ Staff list:', JSON.stringify(staffList, null, 2));

        // 3. Remove Staff Member
        console.log('🔄 Removing staff member...');
        const removeResult = await pharmacyRegistrationService.removeStaffMember(ownerId, staffResult.userId);
        console.log('✅ Staff member removed:', JSON.stringify(removeResult, null, 2));

        await AppDataSource.destroy();
        console.log('🏁 Staff verification DONE.');
    } catch (e) {
        console.error('❌ STAFF ERROR:', e);
        if (e.stack) console.error(e.stack);
        process.exit(1);
    }
}

testStaff();
