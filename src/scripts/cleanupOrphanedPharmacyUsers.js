// src/scripts/cleanupOrphanedPharmacyUsers.js
//
// Deletes pharmacy users that have no corresponding pharmacy_profile record.
// These are left behind when registration fails after the user row is saved
// but before the pharmacy profile is saved (no transaction).
//
// Usage:
//   node src/scripts/cleanupOrphanedPharmacyUsers.js          -- dry run (safe, shows what would be deleted)
//   node src/scripts/cleanupOrphanedPharmacyUsers.js --delete  -- actually deletes

const AppDataSource = require('../config/database');

const isDryRun = !process.argv.includes('--delete');
const env = process.env.NODE_ENV || 'development';

async function run() {
  console.log(`\n🔍 Orphaned Pharmacy User Cleanup`);
  console.log(`   Environment : ${env}`);
  console.log(`   Mode        : ${isDryRun ? 'DRY RUN (no changes)' : '⚠️  LIVE DELETE'}\n`);

  if (!isDryRun && env === 'production') {
    console.log('⚠️  Running a live delete in PRODUCTION.');
    console.log('   You have 5 seconds to cancel (Ctrl+C)...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected\n');

    const queryRunner = AppDataSource.createQueryRunner();

    // Find all orphaned pharmacy users
    const orphans = await queryRunner.query(`
      SELECT u.id, u.email, u."fullName", u."createdAt"
      FROM users u
      WHERE u.role = 'pharmacy'
        AND u.id NOT IN (
          SELECT pp."userId"
          FROM pharmacy_profiles pp
          WHERE pp."userId" IS NOT NULL
        )
      ORDER BY u."createdAt" DESC
    `);

    if (orphans.length === 0) {
      console.log('✅ No orphaned pharmacy users found. Nothing to clean up.');
      await AppDataSource.destroy();
      return;
    }

    console.log(`Found ${orphans.length} orphaned pharmacy user(s):\n`);
    orphans.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.email} — ${u.fullName} (created: ${new Date(u.createdAt).toISOString()})`);
    });

    if (isDryRun) {
      console.log(`\n💡 Dry run — no rows deleted.`);
      console.log(`   To actually delete, run:\n`);
      console.log(`   node src/scripts/cleanupOrphanedPharmacyUsers.js --delete\n`);
    } else {
      const ids = orphans.map(u => `'${u.id}'`).join(', ');
      await queryRunner.query(`
        DELETE FROM users
        WHERE id IN (${ids})
      `);
      console.log(`\n🗑️  Deleted ${orphans.length} orphaned pharmacy user(s).`);
    }

    await queryRunner.release();
    await AppDataSource.destroy();
    console.log('\n✅ Done.\n');
  } catch (err) {
    console.error('\n💥 Script failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();
