module.exports = class PreloadProfileOptions1698765432101 {
    async up(queryRunner) {
      const options = [
        // Patient Profile Options
        { profileType: 'patient', field: 'gender', value: 'male' },
        { profileType: 'patient', field: 'gender', value: 'female' },
        { profileType: 'patient', field: 'gender', value: 'other' },
        { profileType: 'patient', field: 'bloodGroup', value: 'A+' },
        { profileType: 'patient', field: 'bloodGroup', value: 'A-' },
        { profileType: 'patient', field: 'bloodGroup', value: 'B+' },
        { profileType: 'patient', field: 'bloodGroup', value: 'B-' },
        { profileType: 'patient', field: 'bloodGroup', value: 'AB+' },
        { profileType: 'patient', field: 'bloodGroup', value: 'AB-' },
        { profileType: 'patient', field: 'bloodGroup', value: 'O+' },
        { profileType: 'patient', field: 'bloodGroup', value: 'O-' },
        { profileType: 'patient', field: 'genotype', value: 'AA' },
        { profileType: 'patient', field: 'genotype', value: 'AS' },
        { profileType: 'patient', field: 'genotype', value: 'SS' },
        { profileType: 'patient', field: 'genotype', value: 'AC' },
        { profileType: 'patient', field: 'genotype', value: 'SC' },
        { profileType: 'patient', field: 'profileType', value: 'individual' },
        { profileType: 'patient', field: 'profileType', value: 'group' },
        { profileType: 'patient', field: 'physicalActivityLevel', value: 'sedentary' },
        { profileType: 'patient', field: 'physicalActivityLevel', value: 'light' },
        { profileType: 'patient', field: 'physicalActivityLevel', value: 'moderate' },
        { profileType: 'patient', field: 'physicalActivityLevel', value: 'active' },
        { profileType: 'patient', field: 'physicalActivityLevel', value: 'very active' },
        { profileType: 'patient', field: 'dietType', value: 'omnivore' },
        { profileType: 'patient', field: 'dietType', value: 'vegetarian' },
        { profileType: 'patient', field: 'dietType', value: 'vegan' },
        { profileType: 'patient', field: 'dietType', value: 'pescatarian' },
        { profileType: 'patient', field: 'dietType', value: 'keto' },
        { profileType: 'patient', field: 'preferredCommunication', value: 'email' },
        { profileType: 'patient', field: 'preferredCommunication', value: 'phone' },
        { profileType: 'patient', field: 'preferredCommunication', value: 'sms' },
        { profileType: 'patient', field: 'languagePreference', value: 'english' },
        { profileType: 'patient', field: 'languagePreference', value: 'yoruba' },
        { profileType: 'patient', field: 'languagePreference', value: 'hausa' },
        { profileType: 'patient', field: 'languagePreference', value: 'igbo' },
        // Doctor Profile Options
        { profileType: 'doctor', field: 'gender', value: 'male' },
        { profileType: 'doctor', field: 'gender', value: 'female' },
        { profileType: 'doctor', field: 'gender', value: 'other' },
        { profileType: 'doctor', field: 'daysAvailableFrom', value: 'monday' },
        { profileType: 'doctor', field: 'daysAvailableFrom', value: 'tuesday' },
        { profileType: 'doctor', field: 'daysAvailableFrom', value: 'wednesday' },
        { profileType: 'doctor', field: 'daysAvailableFrom', value: 'thursday' },
        { profileType: 'doctor', field: 'daysAvailableFrom', value: 'friday' },
        { profileType: 'doctor', field: 'daysAvailableFrom', value: 'saturday' },
        { profileType: 'doctor', field: 'daysAvailableFrom', value: 'sunday' },
        { profileType: 'doctor', field: 'daysAvailableTo', value: 'monday' },
        { profileType: 'doctor', field: 'daysAvailableTo', value: 'tuesday' },
        { profileType: 'doctor', field: 'daysAvailableTo', value: 'wednesday' },
        { profileType: 'doctor', field: 'daysAvailableTo', value: 'thursday' },
        { profileType: 'doctor', field: 'daysAvailableTo', value: 'friday' },
        { profileType: 'doctor', field: 'daysAvailableTo', value: 'saturday' },
        { profileType: 'doctor', field: 'daysAvailableTo', value: 'sunday' },
        { profileType: 'doctor', field: 'paymentMethod', value: 'bank_transfer' },
        { profileType: 'doctor', field: 'paymentMethod', value: 'mobile_money' },
        { profileType: 'doctor', field: 'frequencyPayout', value: 'daily' },
        { profileType: 'doctor', field: 'frequencyPayout', value: 'weekly' },
        { profileType: 'doctor', field: 'frequencyPayout', value: 'monthly' },
      ];
  
      for (const option of options) {
        await queryRunner.query(
          `INSERT INTO profile_options (id, "profileType", field, value, "createdAt", "updatedAt")
           VALUES (uuid_generate_v4(), $1, $2, $3, NOW(), NOW())`,
          [option.profileType, option.field, option.value]
        );
      }
    }
  
    async down(queryRunner) {
      await queryRunner.query(`DELETE FROM profile_options`);
    }
  };