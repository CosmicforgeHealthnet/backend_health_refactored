/**
 * FORCE VERIFY DOCTOR CLI
 * Usage: node src/scripts/verify-doctor.js <doctor_email> [issue_year]
 */
const AppDataSource = require("../config/database");
const doctorVerificationService = require("../features/doctor/services/doctorVerificationService");
const userRepository = require("../features/auth/repositories/userRepository");
const verificationRequestRepo = require("../features/doctor/repositories/verificationRequestRepository");

async function verify() {
    const email = process.argv[2];
    const issueYear = process.argv[3];
    
    if (!email) {
        console.error("❌ Please provide a doctor email: node src/scripts/verify-doctor.js doctor@example.com [issue_year]");
        process.exit(1);
    }

    console.log(`🚀 Starting force-verification for: ${email}`);
    
    try {
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
        console.log("✅ Database connected.");

        // 1. Find the User
        const user = await userRepository.findByEmail(email);
        if (!user || user.role !== 'doctor') {
            console.error(`❌ User not found or is not a doctor: ${email}`);
            process.exit(1);
        }
        console.log(`👤 Found Doctor: ${user.fullName} (ID: ${user.id})`);

        // 2. Find their active verification request
        let verificationRequest = await verificationRequestRepo.findActiveByDoctorId(user.id);
        
        if (!verificationRequest) {
            console.log("⚠️ No active verification request found. Creating a dummy one to proceed...");
            // Create a minimal request if none exists so we can "approve" it
            verificationRequest = await verificationRequestRepo.create({
                doctorId: user.id,
                licenseNumber: "VERIFIED-VIA-CLI",
                countryCode: user.country || "GB",
                issuingAuthority: "ADMIN-CLI",
                issueDate: issueYear ? new Date(`${issueYear}-01-01`) : null,
                status: "pending",
                method: "manual",
                tier: "tier_1",
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            });
        }

        console.log(`📄 Using Verification Request: ${verificationRequest.id} (Status: ${verificationRequest.status})`);

        // 3. Trigger the full Approval logic
        // We use the doctor's own ID as the 'approvedBy' UUID to satisfy database constraints
        console.log("🔄 Triggering Master Approval Service...");
        const result = await doctorVerificationService.approveVerification(
            verificationRequest.id, 
            user.id, 
            "Verified via CLI emergency tool"
        );

        // 4. Fetch the updated user to show confirmation
        const updatedUser = await userRepository.findById(user.id);

        console.log("\n✨ VERIFICATION SUCCESSFUL!");
        console.log(`✅ User Status: ${updatedUser.status}`);
        console.log(`✅ Wallet: ${result.walletSetup.created ? "NEWLY CREATED" : "ALREADY EXISTS"}`);
        console.log(`✅ Subscription: ${result.subscriptionSetup.created ? "NEWLY CREATED (FREE TIER)" : "ALREADY EXISTS"}`);
        console.log(`✅ Record IDs: Wallet(${result.walletSetup.walletId}), Sub(${result.subscriptionSetup.subscriptionId})`);
        
        process.exit(0);
    } catch (error) {
        console.error("❌ Verification failed:", error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

verify();
