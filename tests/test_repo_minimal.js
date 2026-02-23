
const AppDataSource = require('../src/config/database');
const userRepo = require('../src/features/auth/repositories/userRepository');

async function run() {
    try {
        console.log('🔄 Initializing DB...');
        await AppDataSource.initialize();
        console.log('✅ DB Initialized.');

        console.log('📋 Repo Entity:', userRepo.repo.metadata.name);
        console.log('🔍 Testing userRepo.findByEmail...');
        const user = await userRepo.findByEmail('service_test@example.com');
        console.log('✅ Found:', user ? user.email : 'No user');

        await AppDataSource.destroy();
    } catch (err) {
        console.error('💥 ERROR:', err);
        console.error(err.stack);
        process.exit(1);
    }
}

run();
