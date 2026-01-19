// src/services/labFacilityService.js
const labFacilityRepository = require("../../repositories/lab_facility");
const {
  sendLabFacilityRegistrationEmail,
  sendAdminLabFacilityNotificationEmail,
} = require("../../../../shared/services/email/helper/lab");
const { FACILITY_STATUS } = require("../../utils/constants");

class LabFacilitySubService {
  //BREAKING THE REGISTRATION

  /**
   * Step 1: Admin Information
   */
  async registerStep1(step1Data) {
    // Validate step 1 fields
    this.validateStep1Data(step1Data);

    // Check for duplicate admin email
    const existingAdminEmail = await labFacilityRepository.findByAdminEmail(
      step1Data.adminEmail
    );
    if (existingAdminEmail) {
      throw new Error("Admin email already registered with another facility");
    }

    const facility = labFacilityRepository.create({
      ...step1Data,
      registrationStep: 1,
      registrationCompleted: false,
      status: FACILITY_STATUS.DRAFT, // New status for incomplete registrations
    });

    return labFacilityRepository.save(facility);
  }

  /**
   * Step 2: Facility Information
   */
  async registerStep2(facilityId, step2Data) {
    const facility = await labFacilityRepository.findById(facilityId);

    try {
      if (!facility) {
        throw new Error("Facility not found");
      }

      if (facility.registrationStep !== 1) {
        throw new Error("Invalid step. Complete step 1 first.");
      }

      // Validate step 2 fields
      this.validateStep2Data(step2Data);

      // Check for duplicates
      await this.checkStep2Duplicates(step2Data, facilityId);

      // Update facility with step 2 data
      Object.assign(facility, step2Data, { registrationStep: 2 });

      return labFacilityRepository.save(facility);
    } catch (err) {
      throw new Error(err.message);
    }
  }

  /**
   * Step 3: Address & Finalization
   */
  async registerStep3(facilityId, step3Data) {
    const facility = await labFacilityRepository.findById(facilityId);
    if (!facility) {
      throw new Error("Facility not found");
    }

    if (facility.registrationStep !== 2) {
      throw new Error("Invalid step. Complete steps 1 and 2 first.");
    }

    // Validate step 3 fields
    this.validateStep3Data(step3Data);

    // Check facility email duplicate
    if (step3Data.email) {
      const existingEmail = await labFacilityRepository.findByEmail(
        step3Data.email
      );
      if (existingEmail && existingEmail.id !== facilityId) {
        throw new Error("Facility email already registered");
      }
    }

    // Update and finalize registration
    Object.assign(facility, step3Data, {
      registrationStep: 3,
      registrationCompleted: true,
      status: "pending_approval",
    });

    const savedFacility = await labFacilityRepository.save(facility);

    // Send emails (same as before)
    try {
      await sendLabFacilityRegistrationEmail(savedFacility);
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await sendAdminLabFacilityNotificationEmail(adminEmail, savedFacility);
      }
    } catch (emailError) {
      console.error("Failed to send emails:", emailError);
    }

    return savedFacility;
  }

  // Validation methods for each step
  validateStep1Data(data) {
    const required = ["adminFullName", "adminEmail"];
    for (const field of required) {
      if (!data[field] || data[field].toString().trim() === "") {
        throw new Error(`${field} is required`);
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.adminEmail)) {
      throw new Error("Invalid admin email format");
    }
  }

  validateStep2Data(data) {
    const required = [
      "facilityName",
      "facilityType",
      "registrationNumber",
      "licenseNumber",
    ];
    for (const field of required) {
      if (!data[field] || data[field].toString().trim() === "") {
        throw new Error(`${field} is required`);
      }
    }
  }

  validateStep3Data(data) {
    const required = [
      //   "email",
      //   "phone",
      "address",
      "city",
      "state",
      "country",
      "postalCode",
    ];
    for (const field of required) {
      if (!data[field] || data[field].toString().trim() === "") {
        throw new Error(`${field} is required`);
      }
    }

    // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    // if (!emailRegex.test(data.email)) {
    //   throw new Error("Invalid facility email format");
    // }
  }

  async checkStep2Duplicates(data, excludeFacilityId) {
    const [existingRegistration, existingLicense] = await Promise.all([
      labFacilityRepository.findByRegistrationNumber(data.registrationNumber),
      labFacilityRepository.findByLicenseNumber(data.licenseNumber),
    ]);

    if (existingRegistration && existingRegistration.id !== excludeFacilityId) {
      throw new Error("Registration number already in use");
    }
    if (existingLicense && existingLicense.id !== excludeFacilityId) {
      throw new Error("License number already in use");
    }
  }
}

module.exports = new LabFacilitySubService();
