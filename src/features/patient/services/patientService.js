const patientProfileRepository = require("../repositories/patientProfileRepository");
const userRepository = require("../../auth/repositories/userRepository");
const { USER_ROLES } = require("../../../shared/utils/constants");
const patientActivityListener = require("./patientActivityListener"); // Import Listener

class PatientService {
    /**
     * Create a new patient profile
     */
    async createPatientProfile(data) {
        if (data.user && (await patientProfileRepository.findByUserId(data.user.id))) {
            throw new Error("Patient profile already exists for this user");
        }

        let user;
        if (data.user) {
            user = await userRepository.findById(data.user.id);
            if (!user) throw new Error("User not found");
        } else if (data.email) {
            user = userRepository.create({ email: data.email, fullName: data.fullName });
            user = await userRepository.save(user);
        } else {
            throw new Error("User ID or email is required");
        }

        const patientProfileData = {
            fullName: data.fullName,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth,
            genotype: data.genotype,
            bloodGroup: data.bloodGroup,
            nationality: data.nationality,
            language: data.language,
            mobileNumber: data.mobileNumber,
            email: data.email,
            address: data.address,
            emergencyContactFullName: data.emergencyContactFullName,
            emergencyContactMobile: data.emergencyContactMobile,
            emergencyContactRelationship: data.emergencyContactRelationship,
            height: data.height,
            weight: data.weight,
            bmi: data.bmi,
            bloodPressure: data.bloodPressure,
            heartRate: data.heartRate,
            respiratoryRate: data.respiratoryRate,
            temperature: data.temperature,
            spO2: data.spO2,
            bloodGlucose: data.bloodGlucose,
            smokes: data.smokes,
            drinksAlcohol: data.drinksAlcohol,
            physicalActivityLevel: data.physicalActivityLevel,
            dietType: data.dietType,
            sleepDuration: data.sleepDuration,
            profileType: data.profileType,
            user,
        };

        const patientProfile = await patientProfileRepository.create(patientProfileData);
        const savedProfile = await patientProfileRepository.save(patientProfile);

        // Save related entities
        const relatedEntities = [
            { key: 'medicalConditions', repo: patientProfileRepository.medicalConditionRepo },
            { key: 'surgeries', repo: patientProfileRepository.surgeryRepo },
            { key: 'allergies', repo: patientProfileRepository.allergyRepo },
            { key: 'familyHistories', repo: patientProfileRepository.familyHistoryRepo },
            { key: 'medications', repo: patientProfileRepository.medicationRepo },
            { key: 'immunizations', repo: patientProfileRepository.immunizationRepo },
        ];

        for (const { key, repo } of relatedEntities) {
            if (data[key] && Array.isArray(data[key])) {
                for (const item of data[key]) {
                    await repo.save({ ...item, patientProfile: savedProfile });
                }
            }
        }

        if (data.healthInsurance) {
            await patientProfileRepository.healthInsuranceRepo.save({
                ...data.healthInsurance,
                patientProfile: savedProfile,
            });
        }

        if (data.disability) {
            await patientProfileRepository.disabilityRepo.save({
                ...data.disability,
                patientProfile: savedProfile,
            });
        }

        if (data.consent) {
            await patientProfileRepository.consentRepo.save({
                ...data.consent,
                patientProfile: savedProfile,
            });
        }

        return savedProfile;
    }

    async getPatientProfileById(id) {
        const profile = await patientProfileRepository.findById(id);
        if (!profile) throw new Error("Patient profile not found");
        return profile;
    }

    async getPatientProfileByUserId(userId) {
        return await patientProfileRepository.findByUserId(userId);
    }

    async updatePatientProfile(id, data, req) {
        const checkownerprofile = await this.getPatientProfileByUserId(req.user.sub);
        const profile = await patientProfileRepository.findById(id);

        if (!checkownerprofile || !profile || checkownerprofile.id != profile.id) {
            throw new Error("Patient profile not found");
        }

        const updateData = {
            fullName: data.fullName,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth,
            genotype: data.genotype,
            bloodGroup: data.bloodGroup,
            nationality: data.nationality,
            language: data.language,
            mobileNumber: data.mobileNumber,
            email: data.email,
            address: data.address,
            emergencyContactFullName: data.emergencyContactFullName,
            emergencyContactMobile: data.emergencyContactMobile,
            emergencyContactRelationship: data.emergencyContactRelationship,
            height: data.height,
            weight: data.weight,
            bmi: data.bmi,
            bloodPressure: data.bloodPressure,
            heartRate: data.heartRate,
            respiratoryRate: data.respiratoryRate,
            temperature: data.temperature,
            spO2: data.spO2,
            bloodGlucose: data.bloodGlucose,
            smokes: data.smokes,
            drinksAlcohol: data.drinksAlcohol,
            physicalActivityLevel: data.physicalActivityLevel,
            dietType: data.dietType,
            sleepDuration: data.sleepDuration,
            profileType: data.profileType,
        };

        Object.keys(updateData).forEach(
            (key) => updateData[key] === undefined && delete updateData[key]
        );

        // Update related entities
        // Update related entities
        const relatedEntities = [
            { key: 'medicalConditions', repo: patientProfileRepository.medicalConditionRepo, uniqueField: 'name' },
            { key: 'surgeries', repo: patientProfileRepository.surgeryRepo, uniqueField: 'name' },
            { key: 'allergies', repo: patientProfileRepository.allergyRepo, uniqueField: 'allergen' },
            { key: 'familyHistories', repo: patientProfileRepository.familyHistoryRepo, uniqueField: 'medicalCondition' },
            { key: 'medications', repo: patientProfileRepository.medicationRepo, uniqueField: 'name' },
            { key: 'immunizations', repo: patientProfileRepository.immunizationRepo, uniqueField: 'vaccine' },
        ];

        for (const { key, repo, uniqueField } of relatedEntities) {
            if (data[key] && Array.isArray(data[key])) {
                // await repo.delete({ patientProfile: { id } }); // REMOVED: Prevent wiping data
                for (const item of data[key]) {
                    let existingRecord = null;

                    // 1. Try to find by ID if provided
                    if (item.id) {
                        existingRecord = await repo.findOne({ where: { id: item.id, patientProfile: { id } } });
                    }

                    // 2. If no ID (or not found), try to find by unique business key
                    if (!existingRecord && item[uniqueField]) {
                        existingRecord = await repo.findOne({
                            where: {
                                patientProfile: { id },
                                [uniqueField]: item[uniqueField]
                            }
                        });
                    }

                    if (existingRecord) {
                        // Update existing record (partial update)
                        await repo.update(existingRecord.id, item);
                    } else {
                        // Create new record
                        await repo.save({ ...item, patientProfile: { id } });
                    }
                }
            }
        }

        if (data.healthInsurance) {
            const existingInsurance = await patientProfileRepository.healthInsuranceRepo.findOne({ where: { patientProfile: { id } } });
            if (existingInsurance) {
                await patientProfileRepository.healthInsuranceRepo.update(existingInsurance.id, data.healthInsurance);
            } else {
                await patientProfileRepository.healthInsuranceRepo.save({ ...data.healthInsurance, patientProfile: { id } });
            }
        }

        if (data.disability) {
            const existingDisability = await patientProfileRepository.disabilityRepo.findOne({ where: { patientProfile: { id } } });
            if (existingDisability) {
                await patientProfileRepository.disabilityRepo.update(existingDisability.id, data.disability);
            } else {
                await patientProfileRepository.disabilityRepo.save({ ...data.disability, patientProfile: { id } });
            }
        }

        if (data.consent) {
            const existingConsent = await patientProfileRepository.consentRepo.findOne({ where: { patientProfile: { id } } });
            if (existingConsent) {
                await patientProfileRepository.consentRepo.update(existingConsent.id, data.consent);
            } else {
                await patientProfileRepository.consentRepo.save({ ...data.consent, patientProfile: { id } });
            }
        }

        const updated = await patientProfileRepository.update(id, updateData);

        // 👂 Trigger AI Listener
        if (updated) {
            const fullProfile = await this.getPatientProfileById(id); // Fetch fresh data for AI
            patientActivityListener.onPatientProfileUpdated(id, fullProfile);
        }

        return updated;
    }

    async deletePatientProfile(id, req) {
        const checkownerprofile = await this.getPatientProfileByUserId(req.user.sub);
        const profile = await patientProfileRepository.findById(id);

        if (!checkownerprofile || !profile || checkownerprofile.id != profile.id) {
            throw new Error("Patient profile not found");
        }

        await patientProfileRepository.delete(id);
    }
}

module.exports = new PatientService();
