const { DataSource } = require('typeorm');
const bcrypt = require('bcrypt');
const entities = require('../src/entities/index');

async function testRegistration() {
    const ds = new DataSource({
        type: 'postgres',
        host: '72.61.20.94',
        port: 5432,
        username: 'postgres',
        password: 'wvlAZUDdnEdjpuxEVSZEJkYFwAYJhDEf',
        database: 'cosmicforge',
        entities: entities,
        synchronize: false,
        logging: true
    });

    try {
        await ds.initialize();
        console.log('✅ DB Connected.');

        const userEmail = `debug_pharmacy_${Date.now()}@example.com`;
        const passwordHash = await bcrypt.hash('Password123!', 12);

        console.log('🔄 Attempting to save User...');
        const userRole = 'pharmacy';
        const userStatus = 'pending_email_verification';

        // Manual insert to see exact failure
        const queryRunner = ds.createQueryRunner();

        try {
            const userResult = await queryRunner.query(
                `INSERT INTO users ("fullName", "email", "passwordHash", "role", "status", "createdAt", "updatedAt") 
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id`,
                ['Test User', userEmail, passwordHash, userRole, userStatus]
            );
            const userId = userResult[0].id;
            console.log(`✅ User saved. ID: ${userId}`);

            console.log('🔄 Attempting to save PharmacyProfile...');
            // We manually add the pharmacy profile to check for column issues
            const pharmacyResult = await queryRunner.query(
                `INSERT INTO pharmacy_profiles (
          "userId", "pharmacyName", "registrationNumber", "address", "phone", 
          "primaryContactPerson", "email", "preferredUsername", "verificationStatus", 
          "documentsSubmitted", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING id`,
                [
                    userId, "Test Pharmacy", `REG-${Date.now()}`, "123 Test St", "08012345678",
                    "Owner", userEmail, `testpharmacy_${Date.now()}`, "pending", false
                ]
            );
            console.log(`✅ PharmacyProfile saved. ID: ${pharmacyResult[0].id}`);
        } catch (dbErr) {
            console.error('❌ DB ERROR during manual insert:', dbErr);
        }

        await ds.destroy();
    } catch (e) {
        console.error('❌ CRITICAL ERROR:', e);
        process.exit(1);
    }
}

testRegistration();
