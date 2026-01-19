/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class MakeDoctorIdNullableInTransactions1750520300000 {
    name = 'MakeDoctorIdNullableInTransactions1750520300000'

    async up(queryRunner) {
        // Check if doctorId column exists and is NOT NULL
        const columnInfo = await queryRunner.query(`
            SELECT 
                column_name,
                is_nullable,
                data_type
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'transactions' 
            AND column_name = 'doctorId'
        `);
        
        if (columnInfo.length > 0 && columnInfo[0].is_nullable === 'NO') {
            console.log('Making doctorId nullable in transactions table...');
            
            // Make doctorId nullable for subscription and other non-appointment payments
            await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "doctorId" DROP NOT NULL`);
            
            // Add a check constraint to ensure doctorId is required for appointment payments
            // but optional for other service types
            await queryRunner.query(`
                ALTER TABLE "transactions" 
                ADD CONSTRAINT "chk_doctor_required_for_appointments" 
                CHECK (
                    CASE 
                        WHEN "serviceType" = 'appointment' THEN "doctorId" IS NOT NULL
                        ELSE TRUE
                    END
                )
            `);
            
            // Add comment to clarify the business logic
            await queryRunner.query(`
                COMMENT ON COLUMN "transactions"."doctorId" IS 
                'Doctor ID - required for appointment payments, optional for subscription/other payments'
            `);
            
            console.log('✅ Successfully made doctorId nullable with business logic constraint');
        } else {
            console.log('doctorId column is already nullable or does not exist');
        }
    }

    async down(queryRunner) {
        // Remove the check constraint
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "chk_doctor_required_for_appointments"`);
        
        // Before making doctorId NOT NULL again, we need to handle existing NULL values
        // Set a default doctor ID for subscription payments (you may need to adjust this)
        console.log('Warning: This rollback will fail if there are subscription payments with NULL doctorId');
        console.log('You may need to manually clean up data before running this rollback');
        
        // Uncomment the line below only if you're sure all NULL doctorId rows are handled
        // await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "doctorId" SET NOT NULL`);
        
        // Remove comment
        await queryRunner.query(`COMMENT ON COLUMN "transactions"."doctorId" IS NULL`);
    }
}