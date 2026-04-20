// script test/check_doctor_status.js
const { DataSource } = require("typeorm");
const path = require("node:path");
require("reflect-metadata");

// Load Environment Variables
require("dotenv").config({ path: path.join(__dirname, "../.env.development") });

// Import Entities
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
  logging: false,
  entities: entities,
});

async function check() {
  try {
    await AppDataSource.initialize();
    
    const userRepository = AppDataSource.getRepository("User");
    const doctorProfileRepository = AppDataSource.getRepository("DoctorProfile");
    const verificationRequestRepository = AppDataSource.getRepository("VerificationRequest");
    const verificationDocumentRepository = AppDataSource.getRepository("VerificationDocument");

    const doctor = await userRepository.findOneBy({ email: "doctor@test.com" });
    if (!doctor) {
      console.log("❌ Doctor not found");
      return;
    }

    console.log("👨‍⚕️ Doctor User Status:", doctor.status);

    const profile = await doctorProfileRepository.findOneBy({ userId: doctor.id });
    console.log("📄 Doctor Profile Data:", JSON.stringify(profile, null, 2));

    const requests = await verificationRequestRepository.find({
        where: { doctorId: doctor.id },
        relations: ['documents']
    });
    console.log("🔍 Verification Requests count:", requests.length);
    if (requests.length > 0) {
      console.log("📜 Latest Request Status:", requests[0].status);
      console.log("📄 Documents count:", requests[0].documents.length);
      if (requests[0].documents.length > 0) {
        console.log("📑 First Document Status:", requests[0].documents[0].status);
      }
    }

  } catch (error) {
    console.error("❌ Check failed:", error);
  } finally {
    await AppDataSource.destroy();
  }
}

check();
