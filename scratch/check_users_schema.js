const AppDataSource = require('../src/config/database');

async function checkSchema() {
    try {
        await AppDataSource.initialize();
        const results = await AppDataSource.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
            ORDER BY column_name;
        `);
        console.log('Columns in "users" table:');
        results.forEach(row => console.log(`- ${row.column_name} (${row.data_type})`));
        await AppDataSource.destroy();
    } catch (error) {
        console.error('Error checking schema:', error);
        process.exit(1);
    }
}

checkSchema();
