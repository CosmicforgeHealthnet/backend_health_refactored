// script test/seed_appointments.js
const { DataSource } = require("typeorm");
const bcrypt = require("bcryptjs");
const path = require("node:path");
require("reflect-metadata");

// Load Environment Variables
require("dotenv").config({ path: path.join(__dirname, "../.env.development") });

// Import Entities from the centralized index
const entities = require("../src/entities/index");

const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging: true,
  entities: entities,
});

async function seed() {
  try {
    console.log("🚀 Initializing database connection...");
    await AppDataSource.initialize();
    console.log("✅ Database connected.");

    const userRepository = AppDataSource.getRepository("User");
    const doctorProfileRepository = AppDataSource.getRepository("DoctorProfile");
    const doctorPricingRepository = AppDataSource.getRepository("DoctorPricing");
    const doctorAvailabilityRepository = AppDataSource.getRepository("DoctorAvailability");
    const doctorWalletRepository = AppDataSource.getRepository("DoctorWallet");
    const patientProfileRepository = AppDataSource.getRepository("PatientProfile");
    const subscriptionRepository = AppDataSource.getRepository("Subscription");

    const passwordHash = await bcrypt.hash("Password123!", 10);

    // ==========================================
    // 1. SEED DOCTOR
    // ==========================================
    console.log("👨‍⚕️ Seeding Doctor...");
    
    // Check if doctor exists
    let doctor = await userRepository.findOneBy({ email: "doctor@test.com" });
    if (doctor) {
      console.log("🤝 Doctor already exists. Skipping creation.");
    } else {
      doctor = userRepository.create({
        fullName: "Dr. John Smith",
        email: "doctor@test.com",
        passwordHash: passwordHash,
        role: "doctor",
        status: "doctor_active",
        tier: "professional",
        phoneNumber: "+2348012345678",
        departmentSpecialty: "General Practice",
        country: "Nigeria",
        isOnline: true
      });
      doctor = await userRepository.save(doctor);
      console.log("✅ Doctor User created.");
    }

    // Doctor Profile
    let doctorProfile = await doctorProfileRepository.findOneBy({ userId: doctor.id });
    if (!doctorProfile) {
      doctorProfile = doctorProfileRepository.create({
        userId: doctor.id,
        gender: "male",
        dateOfBirth: "1980-01-01",
        nationality: "Nigerian",
        residentialAddress: "123 Medical Drive, Lagos",
        contactNumber: "+2348012345678"
      });
      doctorProfile = await doctorProfileRepository.save(doctorProfile);
      console.log("✅ Doctor Profile created.");
    } else {
       // Update basic profile info if needed
       await doctorProfileRepository.update(doctorProfile.id, {
          updatedAt: new Date()
       });
       console.log("✅ Doctor Profile updated.");
    }

    // Doctor Verification Request
    const verificationRequestRepository = AppDataSource.getRepository("VerificationRequest");
    let verificationRequest = await verificationRequestRepository.findOneBy({ doctorId: doctor.id });
    if (!verificationRequest) {
      verificationRequest = verificationRequestRepository.create({
        doctorId: doctor.id,
        licenseNumber: "MDCN/12345",
        countryCode: "NG",
        issuingAuthority: "Medical and Dental Council of Nigeria",
        licenseType: "General Practice",
        status: "approved",
        method: "manual",
        tier: "tier_1",
        confidenceScore: 100,
        submittedAt: new Date(),
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        createdBy: doctor.id
      });
      verificationRequest = await verificationRequestRepository.save(verificationRequest);
      console.log("✅ Doctor Verification Request created (Approved).");
    }

    // Doctor Verification Document
    const verificationDocumentRepository = AppDataSource.getRepository("VerificationDocument");
    let verificationDoc = await verificationDocumentRepository.findOneBy({ verificationRequestId: verificationRequest.id });
    if (!verificationDoc) {
      verificationDoc = verificationDocumentRepository.create({
        verificationRequestId: verificationRequest.id,
        documentType: "medical_license",
        originalFileName: "medical_license.pdf",
        storedFileName: "seed_license.pdf",
        filePath: "verification/seed_license.pdf",
        fileSize: 1024 * 512,
        mimeType: "application/pdf",
        fileHash: "seed_hash_12345",
        status: "verified",
        verifiedAt: new Date(),
        uploadedBy: doctor.id
      });
      await verificationDocumentRepository.save(verificationDoc);
      console.log("✅ Doctor Verification Document created (Verified).");
    }

    // Seed Professional License (Required for profile completion)
    const professionalLicenseRepository = AppDataSource.getRepository("ProfessionalLicense");
    let license = await professionalLicenseRepository.findOneBy({ doctorProfile: { id: doctorProfile.id } });
    if (!license) {
      license = professionalLicenseRepository.create({
        doctorProfile: doctorProfile,
        medicalLicenseNumber: "MDCN/12345",
        countryOfLicense: "Nigeria",
        licenseAuthority: "MDCN",
        yearsOfExperience: 10,
        medicalInstitution: "University of Lagos"
      });
      await professionalLicenseRepository.save(license);
      console.log("✅ Doctor Professional License seeded.");
    }

    // Seed Clinical Practice (Required for profile completion)
    const clinicalPracticeRepository = AppDataSource.getRepository("ClinicalPractice");
    let practice = await clinicalPracticeRepository.findOneBy({ doctorProfile: { id: doctorProfile.id } });
    if (!practice) {
      practice = clinicalPracticeRepository.create({
        doctorProfile: doctorProfile,
        clinicName: "City Health Clinic",
        location: "Lagos, Nigeria",
        consultationFee: 5000.00
      });
      await clinicalPracticeRepository.save(practice);
      console.log("✅ Doctor Clinical Practice seeded.");
    }

    // Doctor Pricing
    const existingPricing = await doctorPricingRepository.findOneBy({ doctorId: doctor.id });
    if (!existingPricing) {
      const pricing = doctorPricingRepository.create({
        doctorId: doctor.id,
        consultationType: "consultation",
        price: 5000.00,
        currency: "NGN",
        duration: 30,
        isActive: true
      });
      await doctorPricingRepository.save(pricing);
      console.log("✅ Doctor Pricing created (5000 NGN).");
    }

    // Doctor Availability (Monday to Friday)
    const existingAvailability = await doctorAvailabilityRepository.findOneBy({ doctorId: doctor.id });
    if (!existingAvailability) {
      const days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
      const availabilities = days.map(day => doctorAvailabilityRepository.create({
        doctorId: doctor.id,
        dayOfWeek: day,
        startTime: "09:00:00",
        endTime: "17:00:00",
        isAvailable: true,
        slotDuration: 30,
        timezone: "Africa/Lagos"
      }));
      await doctorAvailabilityRepository.save(availabilities);
      console.log("✅ Doctor Availability created (Mon-Fri, 9am-5pm).");
    }

    // Doctor Wallet
    let doctorWallet = await doctorWalletRepository.findOneBy({ doctorId: doctor.id });
    if (!doctorWallet) {
      doctorWallet = doctorWalletRepository.create({
        doctorId: doctor.id,
        totalBalanceUsd: 0,
        availableBalanceUsd: 0,
        isActive: true,
        preferredDisplayCurrency: "NGN"
      });
      await doctorWalletRepository.save(doctorWallet);
      console.log("✅ Doctor Wallet created.");
    }

    // ==========================================
    // 2. SEED PATIENT
    // ==========================================
    console.log("\n🤒 Seeding Patient...");
    
    // Check if patient exists
    let patient = await userRepository.findOneBy({ email: "patient@test.com" });
    if (patient) {
      console.log("🤝 Patient already exists. Skipping creation.");
    } else {
      patient = userRepository.create({
        fullName: "Jane Doe",
        email: "patient@test.com",
        passwordHash: passwordHash,
        role: "patient",
        status: "active",
        tier: "standard",
        country: "Nigeria",
        timezone: "Africa/Lagos"
      });
      patient = await userRepository.save(patient);
      console.log("✅ Patient User created.");
    }

    // Patient Profile
    let patientProfile = await patientProfileRepository.findOneBy({ userId: patient.id });
    if (!patientProfile) {
      patientProfile = patientProfileRepository.create({
        userId: patient.id,
        gender: "female",
        dateOfBirth: "1995-05-15",
        nationality: "Nigerian",
        bloodGroup: "O+",
        genotype: "AA",
        mobileNumber: "+2348000000001",
        address: "456 Patient Lane, Abuja"
      });
      await patientProfileRepository.save(patientProfile);
      console.log("✅ Patient Profile created.");
    }

    // Patient Subscription
    let subscription = await subscriptionRepository.findOneBy({ userId: patient.id, status: "active" });
    if (!subscription) {
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(now.getMonth() + 1);

      subscription = subscriptionRepository.create({
        userId: patient.id,
        tier: "standard",
        status: "active",
        startDate: now,
        endDate: nextMonth,
        planType: "patient",
        price: 2000.00, // Example price
        currency: "NGN",
        features: JSON.stringify(["telemedicine", "chat", "records"]),
        autoRenew: true
      });
      await subscriptionRepository.save(subscription);
      console.log("✅ Patient Subscription created (Active for 1 month).");
    }

    console.log("\n✨ Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await AppDataSource.destroy();
    console.log("👋 Database connection closed.");
  }
}

seed();
