const AppDataSource = require('../config/database');
const referralService = require('../features/auth/services/referralService');
const User = require('../features/auth/entities/User');
const { IsNull } = require('typeorm');

async function backfillReferralCodes() {
    try {
        console.log('🔄 Connecting to database...');
        await AppDataSource.initialize();
        console.log('✅ Database connected');

        const userRepository = AppDataSource.getRepository(User);

        console.log('🔍 Searching for users without referral codes...');
        const usersWithoutCode = await userRepository.find({
            where: { referralCode: IsNull() },
            select: ['id', 'email', 'fullName'] // minimal selection
        });

        console.log(`📊 Found ${usersWithoutCode.length} users missing referral codes.`);

        if (usersWithoutCode.length === 0) {
            console.log('✨ No action needed.');
            process.exit(0);
        }

        let successCount = 0;
        let errorCount = 0;

        for (const user of usersWithoutCode) {
            try {
                console.log(`🛠 Generatng code for: ${user.email} (${user.id})`);
                const code = await referralService.createUserReferralCode(user.id);
                console.log(`   ✅ Generated: ${code}`);
                successCount++;
            } catch (err) {
                console.error(`   ❌ Failed for ${user.email}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n==========================================');
        console.log(`🎉 Backfill Complete`);
        console.log(`✅ Success: ${successCount}`);
        console.log(`❌ Failed:  ${errorCount}`);
        console.log('==========================================');

    } catch (error) {
        console.error('💥 Critical Error:', error);
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy();
        }
        process.exit(0);
    }
}

// Run the function
backfillReferralCodes();
