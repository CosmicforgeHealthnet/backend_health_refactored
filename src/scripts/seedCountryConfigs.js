// Alternative: Direct seeding script (if you prefer)
// src/scripts/seedCountryConfigs.js
const AppDataSource = require('../config/database');
const countryConfigRepo = require('../features/doctor/repositories/countryVerificationConfigRepository');

async function seedCountryConfigs() {
  try {
    console.log('🌍 Starting country configuration seeding...');

    const countries = [
      // TIER 1 - Automated with APIs
      {
        countryCode: 'ZA',
        countryName: 'South Africa',
        regulatoryBody: 'Health Professions Council of South Africa (HPCSA)',
        tier: 'tier_1',
        method: 'automated',
        hasApi: true,
        apiProvider: 'hpcsa_south_africa',
        apiEndpoint: 'https://api.hpcsa.co.za/verify',
        avgProcessingTime: 1,
        maxProcessingTime: 24,
        requiresManualReview: false,
        requiredDocuments: ['medical_license', 'government_id'],
        optionalDocuments: ['board_certification', 'good_standing_certificate'],
        isActive: true,
        notes: 'Most advanced verification system in Africa. Uses EPIC integration.'
      },

      {
        countryCode: 'KE',
        countryName: 'Kenya',
        regulatoryBody: 'Kenya Medical Practitioners and Dentists Council (KMPDC)',
        tier: 'tier_1',
        method: 'automated',
        hasApi: true,
        apiProvider: 'kmpdc_kenya',
        apiEndpoint: 'https://api.kmpdc.go.ke/verify',
        avgProcessingTime: 2,
        maxProcessingTime: 48,
        requiresManualReview: false,
        requiredDocuments: ['medical_license', 'government_id'],
        optionalDocuments: ['board_certification', 'postgraduate_certificate'],
        isActive: true,
        notes: 'Online register available. Uses EPIC for international graduates.'
      },

      // TIER 2 - Hybrid/Manual
      {
        countryCode: 'NG',
        countryName: 'Nigeria',
        regulatoryBody: 'Medical and Dental Council of Nigeria (MDCN)',
        tier: 'tier_2',
        method: 'hybrid',
        hasApi: false,
        apiProvider: 'mdcn_nigeria',
        avgProcessingTime: 72,
        maxProcessingTime: 168,
        requiresManualReview: true,
        requiredDocuments: ['medical_license', 'medical_degree', 'government_id'],
        optionalDocuments: ['postgraduate_certificate', 'good_standing_certificate'],
        isActive: true,
        notes: 'Database exists but no public API. Manual verification required.'
      },

      {
        countryCode: 'GH',
        countryName: 'Ghana',
        regulatoryBody: 'Ghana Medical and Dental Council',
        tier: 'tier_2',
        method: 'manual',
        hasApi: false,
        avgProcessingTime: 120,
        maxProcessingTime: 240,
        requiresManualReview: true,
        requiredDocuments: ['medical_license', 'medical_degree', 'government_id'],
        optionalDocuments: ['board_certification', 'postgraduate_certificate'],
        isActive: true,
        notes: 'Strong regulatory framework. Manual verification required.'
      },

      // Add more countries as needed...
    ];

    let seededCount = 0;

    for (const countryData of countries) {
      try {
        // Check if country already exists
        const existing = await countryConfigRepo.findByCountryCode(countryData.countryCode);

        if (!existing) {
          await countryConfigRepo.create(countryData);
          console.log(`✅ Seeded ${countryData.countryName} (${countryData.countryCode})`);
          seededCount++;
        } else {
          console.log(`⏭️  ${countryData.countryName} already exists, skipping`);
        }
      } catch (error) {
        console.error(`❌ Error seeding ${countryData.countryName}:`, error.message);
      }
    }

    console.log(`\n🎉 Seeding complete! Added ${seededCount} countries`);

    // Display summary
    const allCountries = await countryConfigRepo.findAllActive();
    console.log(`\n📊 Total active countries: ${allCountries.length}`);

    const tierCounts = allCountries.reduce((acc, country) => {
      acc[country.tier] = (acc[country.tier] || 0) + 1;
      return acc;
    }, {});

    console.log('📈 Countries by tier:', tierCounts);

  } catch (error) {
    console.error('💥 Seeding failed:', error);
    throw error;
  }
}

// Export for running as script
if (require.main === module) {
  AppDataSource.initialize()
    .then(() => seedCountryConfigs())
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { seedCountryConfigs };