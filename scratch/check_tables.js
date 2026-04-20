const AppDataSource = require('../src/config/database');

async function checkTables() {
    try {
        await AppDataSource.initialize();
        const results = await AppDataSource.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name = 'users';
        `);
        console.log('Tables named "users":');
        results.forEach(row => console.log(`- ${row.table_schema}.${row.table_name}`));
        await AppDataSource.destroy();
    } catch (error) {
        console.error('Error checking tables:', error);
        process.exit(1);
    }
}

checkTables();
