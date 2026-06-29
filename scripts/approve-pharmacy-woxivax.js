require("dotenv").config();
const AppDataSource = require("../src/config/database");

async function run() {
  await AppDataSource.initialize();

  const userRepo     = AppDataSource.getRepository("User");
  const pharmacyRepo = AppDataSource.getRepository("PharmacyProfile");
  const vendorRepo   = AppDataSource.getRepository("VendorProfile");
  const walletRepo   = AppDataSource.getRepository("VendorWallet");

  const email = "woxivax334@adsprite.com";

  // Find user
  const user = await userRepo.findOne({ where: { email } });
  if (!user) { console.error("❌ User not found:", email); process.exit(1); }
  console.log("✅ User found:", user.id, user.email, "role:", user.role);

  // Find pharmacy profile
  const pharmacy = await pharmacyRepo.findOne({ where: { userId: user.id } });
  if (!pharmacy) { console.error("❌ No pharmacy profile found for this user"); process.exit(1); }
  console.log("✅ Pharmacy found:", pharmacy.id, pharmacy.pharmacyName, "status:", pharmacy.verificationStatus);

  // Approve pharmacy
  await pharmacyRepo.update(pharmacy.id, {
    verificationStatus: "approved",
    isActive: true,
  });
  console.log("✅ Pharmacy approved");

  // Ensure vendor profile exists (hybrid pharmacy)
  const existing = await vendorRepo.findOne({ where: { userId: user.id } });
  if (existing) {
    console.log("ℹ️  Vendor profile already exists:", existing.id);
  } else {
    const vendor = vendorRepo.create({
      userId:              user.id,
      businessName:        pharmacy.pharmacyName,
      businessCategory:    "health_wellness",
      businessEmail:       pharmacy.email || null,
      businessPhone:       pharmacy.phone || null,
      country:             "Nigeria",
      state:               "",
      city:                "",
      fullAddress:         pharmacy.address || "",
      businessDescription: `${pharmacy.pharmacyName} — Licensed Pharmacy`,
      verificationStatus:  "approved",
      isActive:            true,
      documentsSubmitted:  true,
      isHybridPharmacy:    true,
      pharmacyProfileId:   pharmacy.id,
    });
    const saved = await vendorRepo.save(vendor);
    console.log("✅ Vendor profile created:", saved.id);

    await walletRepo.save(walletRepo.create({
      vendorId:            saved.id,
      availableBalanceNgn: 0,
      pendingClearanceNgn: 0,
      totalEarningsNgn:    0,
      isActive:            true,
      isFrozen:            false,
    }));
    console.log("✅ Vendor wallet created");
  }

  await AppDataSource.destroy();
  console.log("\nDone — account is now approved.");
}

run().catch(e => { console.error(e); process.exit(1); });
