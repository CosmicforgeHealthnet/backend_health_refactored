const { DataSource } = require('typeorm');
require('dotenv').config({ path: '.env.development' });

async function main() {
    const ds = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    try {
        await ds.initialize();
        console.log('✅ DB Connected.');
        const queryRunner = ds.createQueryRunner();

        console.log('🔄 Adding columns to pharmacy_profiles...');
        await queryRunner.query('ALTER TABLE IF EXISTS pharmacy_profiles ADD COLUMN IF NOT EXISTS "defaultCurrency" varchar(3) DEFAULT \'NGN\' NOT NULL');
        await queryRunner.query('ALTER TABLE IF EXISTS pharmacy_profiles ADD COLUMN IF NOT EXISTS "serviceRadius" decimal(10,2) DEFAULT 0 NOT NULL');
        await queryRunner.query('ALTER TABLE IF EXISTS pharmacy_profiles ADD COLUMN IF NOT EXISTS "notificationPreferences" json');

        console.log('🔄 Adding columns to users...');
        await queryRunner.query('ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS "pharmacyId" uuid');

        console.log('🔄 Creating pharmacy_pricing table...');
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "pharmacy_pricing" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "pharmacyId" uuid NOT NULL,
                "feeType" varchar NOT NULL,
                "price" decimal(10,2) NOT NULL,
                "currency" varchar(3) NOT NULL DEFAULT 'NGN',
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_pharmacy_pricing" PRIMARY KEY ("id"),
                CONSTRAINT "FK_pharmacy_pricing_pharmacy" FOREIGN KEY ("pharmacyId") REFERENCES "pharmacy_profiles"("id") ON DELETE CASCADE
            )
        `);
        // Add indices if they don't exist (using try/catch or just ignore errors for simplicity in temp script)
        try { await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_pharmacy_pricing_pharmacyId" ON "pharmacy_pricing" ("pharmacyId")'); } catch { /* ignore */ }
        try { await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_pharmacy_pricing_feeType" ON "pharmacy_pricing" ("feeType")'); } catch { /* ignore */ }

        console.log('🚀 Success! Columns and tables added.');

        const table = await queryRunner.getTable('pharmacy_profiles');
        console.log('Current PharmacyProfile Columns:', table.columns.map(c => c.name).join(', '));

        await ds.destroy();
    } catch (e) {
        console.error('❌ CRITICAL ERROR:', e);
        process.exit(1);
    }
}

main();
