/**
 * Seed script: creates 3 fully-verified test accounts
 *   - cf.patient@cosmicforge.dev    / TestPatient@123   (gold_elite)
 *   - cf.doctor@cosmicforge.dev     / TestDoctor@123    (professional, verified)
 *   - cf.pharmacy@cosmicforge.dev   / TestPharmacy@123  (gold_elite, verified)
 *
 * Run:  node scripts/seed-test-accounts.js
 */

const { Client } = require('pg');

const client = new Client({
  host: '72.61.20.94',
  port: 5432,
  database: 'cosmicforge_clean',
  user: 'postgres',
  password: 'wvlAZUDdnEdjpuxEVSZEJkYFwAYJhDEf',
  ssl: false,
});

// Pre-computed bcrypt hashes (cost 12)
const HASHES = {
  patient:  '$2a$12$2OKn2jvyoJ8nqNuZUVZqsO.5xsTf66Sh3GHA5IulptGJCrN3YyjR.',
  doctor:   '$2a$12$wTN3ZGcXPF26nxxtbv/SuO33X9PmbfNWzT.i2iLZjV.HbFDXFRGze',
  pharmacy: '$2a$12$coPdwEWeGf0M17G77sb0k.jKKJUxOhfYm4wl.1Jg2ymejRaKzlzki',
};

async function run() {
  await client.connect();
  console.log('✅ Connected to database');

  try {
    await client.query('BEGIN');

    // ── Remove any existing test accounts (CASCADE cleans related rows) ──
    await client.query(`
      DELETE FROM users
      WHERE email IN (
        'cf.patient@cosmicforge.dev',
        'cf.doctor@cosmicforge.dev',
        'cf.pharmacy@cosmicforge.dev'
      )
    `);
    console.log('🗑️  Cleared existing test accounts');

    // ════════════════════════════════════════════
    //  PATIENT  — gold_elite, status: active
    // ════════════════════════════════════════════
    const { rows: [patientUser] } = await client.query(`
      INSERT INTO users (
        "fullName", email, "passwordHash", role, status, tier, provider,
        "phoneNumber", "mfaEnabled", "isOnline", "totalReferrals",
        "averageRating", "totalRatings"
      ) VALUES (
        'Test Patient',
        'cf.patient@cosmicforge.dev',
        $1,
        'patient', 'active', 'gold_elite', 'local',
        '+2348000000001', false, false, 0, 0, 0
      ) RETURNING id
    `, [HASHES.patient]);

    await client.query(`
      INSERT INTO patient_profiles ("userId", "profileType", gender, nationality)
      VALUES ($1, 'individual', 'male', 'Nigerian')
    `, [patientUser.id]);

    await client.query(`
      INSERT INTO subscriptions (
        "userId", tier, status, "planType",
        "startDate", "endDate", "autoRenew", price, currency, "billingCycle", "familyMembers"
      ) VALUES (
        $1, 'gold_elite', 'active', 'patient',
        NOW(), NOW() + INTERVAL '10 years', true, 0, 'NGN', 'yearly', 1
      )
    `, [patientUser.id]);

    console.log(`👤 Patient created: ${patientUser.id}`);

    // ════════════════════════════════════════════
    //  DOCTOR — professional tier, fully verified
    // ════════════════════════════════════════════
    const { rows: [doctorUser] } = await client.query(`
      INSERT INTO users (
        "fullName", email, "passwordHash", role, status, tier, provider,
        "phoneNumber", "departmentSpecialty", "mfaEnabled", "isOnline",
        "totalReferrals", "averageRating", "totalRatings"
      ) VALUES (
        'Dr. Test Doctor',
        'cf.doctor@cosmicforge.dev',
        $1,
        'doctor', 'doctor_active', 'professional', 'local',
        '+2348000000002', 'General Practice', false, false, 0, 0, 0
      ) RETURNING id
    `, [HASHES.doctor]);

    const { rows: [doctorProfile] } = await client.query(`
      INSERT INTO doctor_profiles (
        "userId", gender, nationality, "contactNumber", "residentialAddress"
      ) VALUES ($1, 'male', 'Nigerian', '+2348000000002', 'Lagos, Nigeria')
      RETURNING id
    `, [doctorUser.id]);

    await client.query(`
      INSERT INTO professional_licenses (
        "doctorProfileId", "medicalLicenseNumber", "countryOfLicense",
        "licenseAuthority", "yearsOfExperience", "areasOfSpecialization"
      ) VALUES ($1, 'MDCN-TEST-001', 'Nigeria', 'MDCN', 10, ARRAY['General Practice'])
    `, [doctorProfile.id]);

    await client.query(`
      INSERT INTO professional_certificates (
        "doctorProfileId", institution, degree, "fieldOfStudy",
        "startYear", "endYear", "certificateName"
      ) VALUES ($1, 'University of Lagos', 'MBBS', 'Medicine and Surgery', 2005, 2011,
                'Bachelor of Medicine and Surgery')
    `, [doctorProfile.id]);

    await client.query(`
      INSERT INTO clinical_practices (
        "doctorProfileId", "clinicName", location,
        "daysAvailableFrom", "daysAvailableTo",
        "timeAvailableFrom", "timeAvailableTo", "consultationFee"
      ) VALUES ($1, 'CosmicForge Test Clinic', 'Lagos, Nigeria',
                'Monday', 'Friday', '09:00:00', '17:00:00', 50.00)
    `, [doctorProfile.id]);

    await client.query(`
      INSERT INTO digital_health_tools ("doctorProfileId", "consentToUseAITools", "useARVR")
      VALUES ($1, true, false)
    `, [doctorProfile.id]);

    // doctor_wallets references users.id (doctorId → users)
    await client.query(`
      INSERT INTO doctor_wallets (
        "doctorId", "totalBalanceUsd", "pendingCreditsUsd", "availableBalanceUsd",
        "preferredDisplayCurrency", "isActive", "isFrozen"
      ) VALUES ($1, 0, 0, 0, 'NGN', true, false)
    `, [doctorUser.id]);

    await client.query(`
      INSERT INTO verification_requests (
        "doctorId", "licenseNumber", "countryCode", "issuingAuthority",
        "licenseType", status, method, tier, "confidenceScore", "approvedAt"
      ) VALUES (
        $1, 'MDCN-TEST-001', 'NG', 'MDCN',
        'General Practice', 'approved', 'manual', 'tier_1', 100, NOW()
      )
    `, [doctorUser.id]);

    await client.query(`
      INSERT INTO subscriptions (
        "userId", tier, status, "planType",
        "startDate", "endDate", "autoRenew", price, currency, "billingCycle", "familyMembers"
      ) VALUES (
        $1, 'professional', 'active', 'doctor',
        NOW(), NOW() + INTERVAL '10 years', true, 0, 'NGN', 'yearly', 1
      )
    `, [doctorUser.id]);

    console.log(`🩺 Doctor created: ${doctorUser.id}`);

    // ════════════════════════════════════════════
    //  PHARMACY — gold_elite, fully verified
    // ════════════════════════════════════════════
    const { rows: [pharmacyUser] } = await client.query(`
      INSERT INTO users (
        "fullName", email, "passwordHash", role, status, tier, provider,
        "phoneNumber", "mfaEnabled", "isOnline", "totalReferrals",
        "averageRating", "totalRatings"
      ) VALUES (
        'CosmicForge Test Pharmacy',
        'cf.pharmacy@cosmicforge.dev',
        $1,
        'pharmacy', 'pharmacy_active', 'gold_elite', 'local',
        '+2348000000003', false, false, 0, 0, 0
      ) RETURNING id
    `, [HASHES.pharmacy]);

    const { rows: [pharmacyProfile] } = await client.query(`
      INSERT INTO pharmacy_profiles (
        "userId", "pharmacyName", "registrationNumber", address, phone,
        "primaryContactPerson", email, "preferredUsername",
        "licenseNumber", "verificationStatus", "isActive", "documentsSubmitted",
        "defaultCurrency", "serviceRadius"
      ) VALUES (
        $1, 'CosmicForge Test Pharmacy', 'PHARMA-CF-001',
        '123 Test Street, Lagos, Nigeria', '+2348000000003',
        'CosmicForge Test Pharmacy', 'cf.pharmacy@cosmicforge.dev',
        'cfpharmacy', 'PCN-CF-001', 'approved', true, true,
        'NGN', 0
      ) RETURNING id
    `, [pharmacyUser.id]);

    // pharmacy_wallets.pharmacyId → pharmacy_profiles.id
    await client.query(`
      INSERT INTO pharmacy_wallets (
        "pharmacyId", "availableBalanceUsd", "pendingClearanceUsd",
        "totalEarningsUsd", "preferredDisplayCurrency", "isActive", "isFrozen"
      ) VALUES ($1, 0, 0, 0, 'NGN', true, false)
    `, [pharmacyProfile.id]);

    // pharmacy_verification_requests.pharmacyId → pharmacy_profiles.id
    await client.query(`
      INSERT INTO pharmacy_verification_requests (
        "pharmacyId", "requestType", status, priority,
        "reviewedAt", "completedAt"
      ) VALUES ($1, 'initial_verification', 'approved', 'medium', NOW(), NOW())
    `, [pharmacyProfile.id]);

    await client.query(`
      INSERT INTO subscriptions (
        "userId", tier, status, "planType",
        "startDate", "endDate", "autoRenew", price, currency, "billingCycle", "familyMembers"
      ) VALUES (
        $1, 'gold_elite', 'active', 'patient',
        NOW(), NOW() + INTERVAL '10 years', true, 0, 'NGN', 'yearly', 1
      )
    `, [pharmacyUser.id]);

    console.log(`💊 Pharmacy created: ${pharmacyUser.id}`);

    await client.query('COMMIT');

    console.log('\n════════════════════════════════════════════');
    console.log('   TEST ACCOUNTS CREATED SUCCESSFULLY');
    console.log('════════════════════════════════════════════');
    console.log('PATIENT');
    console.log('  email   : cf.patient@cosmicforge.dev');
    console.log('  password: TestPatient@123');
    console.log('  tier    : gold_elite');
    console.log('');
    console.log('DOCTOR');
    console.log('  email   : cf.doctor@cosmicforge.dev');
    console.log('  password: TestDoctor@123');
    console.log('  tier    : professional (fully verified)');
    console.log('');
    console.log('PHARMACY');
    console.log('  email   : cf.pharmacy@cosmicforge.dev');
    console.log('  password: TestPharmacy@123');
    console.log('  tier    : gold_elite (fully verified)');
    console.log('════════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error — rolled back:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
