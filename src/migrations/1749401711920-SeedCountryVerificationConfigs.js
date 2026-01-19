/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class SeedCountryVerificationConfigs1749401711920 {

    async up(queryRunner) {
    // before any INSERTs
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    console.log('🌍 Seeding country verification configurations...');

    // Insert country verification configurations
    await queryRunner.query(`
      INSERT INTO country_verification_configs
    ("id","countryCode","countryName","regulatoryBody","tier","method",
     "hasApi","apiProvider","apiEndpoint","avgProcessingTime","maxProcessingTime",
     "requiresManualReview","requiredDocuments","optionalDocuments","isActive",
     "notes","createdAt","updatedAt")
      VALUES
      
      -- TIER 1 Countries (High confidence, API available)
      (
        uuid_generate_v4(),
        'ZA',
        'South Africa', 
        'Health Professions Council of South Africa (HPCSA)',
        'tier_1',
        'automated',
        true,
        'hpcsa_south_africa',
        'https://api.hpcsa.co.za/verify',
        1, -- 1 hour
        24, -- 24 hours max
        false,
        '["medical_license", "government_id"]',
        '["board_certification", "good_standing_certificate"]',
        true,
        'Most advanced verification system in Africa. Uses EPIC integration and has reliable API access.',
        NOW(),
        NOW()
      ),
      
      (
        uuid_generate_v4(),
        'KE',
        'Kenya',
        'Kenya Medical Practitioners and Dentists Council (KMPDC)', 
        'tier_1',
        'automated',
        true,
        'kmpdc_kenya',
        'https://api.kmpdc.go.ke/verify',
        2, -- 2 hours
        48, -- 48 hours max
        false,
        '["medical_license", "government_id"]',
        '["board_certification", "postgraduate_certificate"]',
        true,
        'Online register available at kmpdc.go.ke. Uses EPIC for international graduates. Fast API response.',
        NOW(),
        NOW()
      ),

      -- TIER 2 Countries (Medium confidence, Hybrid approach)
      (
        uuid_generate_v4(),
        'NG',
        'Nigeria',
        'Medical and Dental Council of Nigeria (MDCN)',
        'tier_2', 
        'hybrid',
        false, -- No direct API yet, but database exists
        'mdcn_nigeria',
        null,
        72, -- 3 days
        168, -- 7 days max
        true,
        '["medical_license", "medical_degree", "government_id"]',
        '["postgraduate_certificate", "good_standing_certificate", "proof_of_practice"]',
        true,
        'Database exists at mdcn.gov.ng but no public API. Manual verification required. Known fraud issues require extra scrutiny.',
        NOW(),
        NOW()
      ),
      
      (
        uuid_generate_v4(),
        'GH',
        'Ghana',
        'Ghana Medical and Dental Council',
        'tier_2',
        'manual',
        false,
        null,
        null,
        120, -- 5 days
        240, -- 10 days max
        true,
        '["medical_license", "medical_degree", "government_id"]',
        '["board_certification", "postgraduate_certificate"]',
        true,
        'Strong regulatory framework under Health Professions Regulatory Bodies Act. Manual verification through direct contact with council.',
        NOW(),
        NOW()
      ),
      
      (
        uuid_generate_v4(),
        'TZ',
        'Tanzania',
        'Tanzania Food and Drugs Authority (TFDA)',
        'tier_2',
        'manual',
        false,
        null,
        null,
        96, -- 4 days
        192, -- 8 days max
        true,
        '["medical_license", "medical_degree", "government_id"]',
        '["board_certification", "good_standing_certificate"]',
        true,
        'Part of East African Community. Self-funded regulatory authority with established systems.',
        NOW(),
        NOW()
      ),
      
      (
        uuid_generate_v4(),
        'UG',
        'Uganda',
        'National Drug Authority (NDA)',
        'tier_2',
        'manual',
        false,
        null,
        null,
        96, -- 4 days
        192, -- 8 days max
        true,
        '["medical_license", "medical_degree", "government_id"]',
        '["board_certification", "postgraduate_certificate"]',
        true,
        'EAC member state. Self-funded through industry fees with minimal government subvention.',
        NOW(),
        NOW()
      ),

      (
        uuid_generate_v4(),
        'MA',
        'Morocco',
        'Ministry of Health Morocco',
        'tier_2',
        'manual',
        false,
        null,
        null,
        72, -- 3 days
        168, -- 7 days max
        true,
        '["medical_license", "medical_degree", "government_id"]',
        '["board_certification", "postgraduate_certificate"]',
        true,
        'North African country with established healthcare system and regulatory framework.',
        NOW(),
        NOW()
      ),

      (
        uuid_generate_v4(),
        'EG',
        'Egypt',
        'Egyptian Medical Syndicate',
        'tier_2',
        'manual',
        false,
        null,
        null,
        96, -- 4 days
        192, -- 8 days max
        true,
        '["medical_license", "medical_degree", "government_id"]',
        '["board_certification", "postgraduate_certificate"]',
        true,
        'Large healthcare market. Manual verification through medical syndicate with established procedures.',
        NOW(),
        NOW()
      ),

      -- TIER 3 Countries (Lower confidence, Manual only)
      (
        uuid_generate_v4(),
        'ET',
        'Ethiopia',
        'Ethiopian Food and Drug Administration',
        'tier_3',
        'manual',
        false,
        null,
        null,
        168, -- 7 days
        336, -- 14 days max
        true,
        '["medical_license", "medical_degree", "government_id", "proof_of_practice"]',
        '["postgraduate_certificate", "good_standing_certificate"]',
        true,
        'Large market but limited regulatory infrastructure. Extended verification required due to documentation challenges.',
        NOW(),
        NOW()
      ),
      
      (
        uuid_generate_v4(),
        'ZM',
        'Zambia',
        'Zambia Medicines Regulatory Authority',
        'tier_3',
        'manual',
        false,
        null,
        null,
        120, -- 5 days
        240, -- 10 days max
        true,
        '["medical_license", "medical_degree", "government_id"]',
        '["board_certification", "good_standing_certificate", "proof_of_practice"]',
        true,
        'SADC member. Manual verification through regulatory authority with standard regional procedures.',
        NOW(),
        NOW()
      ),
      
      (
        uuid_generate_v4(),
        'ZW',
        'Zimbabwe',
        'Medicines Control Authority of Zimbabwe',
        'tier_3',
        'manual',
        false,
        null,
        null,
        144, -- 6 days
        288, -- 12 days max
        true,
        '["medical_license", "medical_degree", "government_id", "proof_of_practice"]',
        '["board_certification", "good_standing_certificate"]',
        true,
        'Economic challenges may affect verification speed. Manual review required with additional documentation.',
        NOW(),
        NOW()
      ),

      (
        uuid_generate_v4(),
        'BW',
        'Botswana',
        'Botswana Medicines Regulatory Authority',
        'tier_3',
        'manual',
        false,
        null,
        null,
        120, -- 5 days
        240, -- 10 days max
        true,
        '["medical_license", "medical_degree", "government_id"]',
        '["board_certification", "good_standing_certificate"]',
        true,
        'SADC member with stable regulatory environment. Manual verification process established.',
        NOW(),
        NOW()
      ),

      (
        uuid_generate_v4(),
        'MW',
        'Malawi',
        'Pharmacy, Medicines and Poisons Board',
        'tier_3',
        'manual',
        false,
        null,
        null,
        144, -- 6 days
        288, -- 12 days max
        true,
        '["medical_license", "medical_degree", "government_id", "proof_of_practice"]',
        '["board_certification", "good_standing_certificate"]',
        true,
        'Manual verification required. Most funding from industry fees rather than government subvention.',
        NOW(),
        NOW()
      ),

      -- Additional African Countries
      (
        uuid_generate_v4(),
        'SN',
        'Senegal',
        'Ministry of Health Senegal',
        'tier_3',
        'manual',
        false,
        null,
        null,
        120, -- 5 days
        240, -- 10 days max
        true,
        '["medical_license", "medical_degree", "government_id"]',
        '["board_certification", "postgraduate_certificate"]',
        true,
        'West African country with French colonial medical education system. Manual verification required.',
        NOW(),
        NOW()
      ),

      (
        uuid_generate_v4(),
        'CI',
        'Ivory Coast',
        'Ministry of Health Ivory Coast',
        'tier_3',
        'manual',
        false,
        null,
        null,
        120, -- 5 days
        240, -- 10 days max
        true,
        '["medical_license", "medical_degree", "government_id"]',
        '["board_certification", "postgraduate_certificate"]',
        true,
        'ECOWAS member state. French-influenced medical education system requiring manual verification.',
        NOW(),
        NOW()
      ),

      (
        uuid_generate_v4(),
        'CM',
        'Cameroon',
        'Ministry of Public Health Cameroon',
        'tier_3',
        'manual',
        false,
        null,
        null,
        144, -- 6 days
        288, -- 12 days max
        true,
        '["medical_license", "medical_degree", "government_id", "proof_of_practice"]',
        '["board_certification", "good_standing_certificate"]',
        true,
        'Bilingual healthcare system (French/English). Extended verification time due to dual regulatory pathways.',
        NOW(),
        NOW()
      ),

      (
        uuid_generate_v4(),
        'RW',
        'Rwanda',
        'Rwanda Food and Drugs Authority',
        'tier_2',
        'manual',
        false,
        null,
        null,
        96, -- 4 days
        192, -- 8 days max
        true,
        '["medical_license", "medical_degree", "government_id"]',
        '["board_certification", "postgraduate_certificate"]',
        true,
        'EAC member with rapidly developing healthcare infrastructure. Government-funded regulatory work.',
        NOW(),
        NOW()
      )
    `);

    console.log('✅ Country verification configurations seeded successfully!');
    
    // Get count of inserted records
    const result = await queryRunner.query(`
      SELECT COUNT(*) as count FROM country_verification_configs WHERE "createdAt" >= NOW() - INTERVAL '1 minute'
    `);
    
    console.log(`📊 Inserted ${result[0].count} country configurations`);
  }

  async down(queryRunner) {
    console.log('🗑️ Removing country verification configurations...');
    
    // Remove seeded data (keep any manually added configs)
    await queryRunner.query(`
      DELETE FROM country_verification_configs 
      WHERE "countryCode" IN (
        'ZA', 'KE', 'NG', 'GH', 'TZ', 'UG', 'MA', 'EG',
        'ET', 'ZM', 'ZW', 'BW', 'MW', 'SN', 'CI', 'CM', 'RW'
      )
    `);
    
    console.log('✅ Country configurations removed');
  }

}
