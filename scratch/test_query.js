const AppDataSource = require('../src/config/database');

async function testQuery() {
    try {
        await AppDataSource.initialize();
        const email = 'doctor@test.com';
        const query = 'SELECT "User"."username" FROM "users" "User" LIMIT 1';
        const results = await AppDataSource.query(query);
        console.log('Query result:', results);
        await AppDataSource.destroy();
    } catch (error) {
        console.error('Query failed in script:', error);
        process.exit(1);
    }
}

testQuery();
