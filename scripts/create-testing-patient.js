#!/usr/bin/env node

const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const AppDataSource = require("../src/config/database");

const EMAIL = (process.env.TEST_PATIENT_EMAIL || "testing@cosmicforge.com").trim().toLowerCase();
const PASSWORD = process.env.TEST_PATIENT_PASSWORD || "TestingPatient@123";
const FULL_NAME = process.env.TEST_PATIENT_FULL_NAME || "Testing Patient";
const PHONE_NUMBER = process.env.TEST_PATIENT_PHONE || "+2348000000009";
const COUNTRY = process.env.TEST_PATIENT_COUNTRY || "Nigeria";
const TIMEZONE = process.env.TEST_PATIENT_TIMEZONE || "Africa/Lagos";
const TIER = process.env.TEST_PATIENT_TIER || "gold_elite";
const CURRENCY = process.env.TEST_PATIENT_CURRENCY || "NGN";
const SUBSCRIPTION_YEARS = Number(process.env.TEST_PATIENT_SUBSCRIPTION_YEARS || 10);

const ALLOWED_TIERS = new Set([
  "free",
  "basic",
  "standard",
  "medium",
  "premium",
  "gold_elite",
  "professional",
]);

function assertConfig() {
  const missing = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASS", "DB_NAME"].filter(
    (name) => !process.env[name]
  );

  if (missing.length) {
    throw new Error(
      `Missing database environment variable(s): ${missing.join(", ")}. ` +
        "Set NODE_ENV or provide the DB_* variables before running this script."
    );
  }

  if (!EMAIL || !EMAIL.includes("@")) {
    throw new Error(`Invalid TEST_PATIENT_EMAIL: ${EMAIL}`);
  }

  if (!ALLOWED_TIERS.has(TIER)) {
    throw new Error(
      `Invalid TEST_PATIENT_TIER "${TIER}". Expected one of: ${[...ALLOWED_TIERS].join(", ")}`
    );
  }

  if (!Number.isInteger(SUBSCRIPTION_YEARS) || SUBSCRIPTION_YEARS < 1) {
    throw new Error("TEST_PATIENT_SUBSCRIPTION_YEARS must be a positive integer.");
  }
}

function buildReferralCode(userId) {
  return crypto
    .createHash("sha256")
    .update(`${userId}:${Date.now()}:${crypto.randomBytes(8).toString("hex")}`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
}

async function createUniqueReferralCode(queryRunner, userId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const referralCode = buildReferralCode(userId);
    const existing = await queryRunner.query(
      `SELECT 1 FROM "users" WHERE "referralCode" = $1 LIMIT 1`,
      [referralCode]
    );

    if (!existing.length) {
      return referralCode;
    }
  }

  throw new Error("Could not generate a unique referral code after 5 attempts.");
}

function addYears(date, years) {
  const copy = new Date(date);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

async function tableExists(queryRunner, tableName) {
  const [{ exists }] = await queryRunner.query(
    `SELECT to_regclass($1) IS NOT NULL AS "exists"`,
    [`public.${tableName}`]
  );

  return exists;
}

async function upsertUser(queryRunner, passwordHash) {
  const existing = await queryRunner.query(
    `SELECT "id", "referralCode" FROM "users" WHERE "email" = $1 LIMIT 1`,
    [EMAIL]
  );

  if (existing.length) {
    const [user] = await queryRunner.query(
      `
        UPDATE "users"
        SET
          "fullName" = $2,
          "passwordHash" = $3,
          "role" = 'patient',
          "status" = 'active',
          "tier" = $4,
          "provider" = 'local',
          "providerId" = NULL,
          "phoneNumber" = $5,
          "country" = $6,
          "timezone" = $7,
          "mfaEnabled" = false,
          "mfaSecret" = NULL,
          "mustChangePassword" = false,
          "passwordChangedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE "id" = $1
        RETURNING "id", "email", "referralCode"
      `,
      [existing[0].id, FULL_NAME, passwordHash, TIER, PHONE_NUMBER, COUNTRY, TIMEZONE]
    );

    return { user, created: false };
  }

  const [user] = await queryRunner.query(
    `
      INSERT INTO "users" (
        "fullName",
        "email",
        "passwordHash",
        "role",
        "status",
        "tier",
        "provider",
        "phoneNumber",
        "country",
        "timezone",
        "mfaEnabled",
        "isOnline",
        "totalReferrals",
        "averageRating",
        "totalRatings",
        "mustChangePassword",
        "passwordChangedAt"
      )
      VALUES (
        $1, $2, $3, 'patient', 'active', $4, 'local',
        $5, $6, $7, false, false, 0, 0, 0, false, NOW()
      )
      RETURNING "id", "email", "referralCode"
    `,
    [FULL_NAME, EMAIL, passwordHash, TIER, PHONE_NUMBER, COUNTRY, TIMEZONE]
  );

  return { user, created: true };
}

async function ensureReferralCode(queryRunner, user) {
  if (user.referralCode) {
    return user.referralCode;
  }

  const referralCode = await createUniqueReferralCode(queryRunner, user.id);
  await queryRunner.query(`UPDATE "users" SET "referralCode" = $2 WHERE "id" = $1`, [
    user.id,
    referralCode,
  ]);

  return referralCode;
}

async function ensurePatientProfile(queryRunner, userId) {
  const [profile] = await queryRunner.query(
    `
      INSERT INTO "patient_profiles" (
        "userId",
        "profileType",
        "nationality",
        "mobileNumber"
      )
      VALUES ($1, 'individual', $2, $3)
      ON CONFLICT ("userId") DO UPDATE
      SET
        "profileType" = COALESCE("patient_profiles"."profileType", EXCLUDED."profileType"),
        "nationality" = COALESCE("patient_profiles"."nationality", EXCLUDED."nationality"),
        "mobileNumber" = COALESCE("patient_profiles"."mobileNumber", EXCLUDED."mobileNumber"),
        "updatedAt" = NOW()
      RETURNING "id"
    `,
    [userId, COUNTRY, PHONE_NUMBER]
  );

  return profile.id;
}

async function ensureSubscription(queryRunner, userId) {
  if (!(await tableExists(queryRunner, "subscriptions"))) {
    return null;
  }

  const now = new Date();
  const endDate = addYears(now, SUBSCRIPTION_YEARS);
  const existing = await queryRunner.query(
    `
      SELECT "id"
      FROM "subscriptions"
      WHERE "userId" = $1
        AND "planType" = 'patient'
        AND "status" = 'active'
      ORDER BY "createdAt" DESC NULLS LAST
      LIMIT 1
    `,
    [userId]
  );

  if (existing.length) {
    const [subscription] = await queryRunner.query(
      `
        UPDATE "subscriptions"
        SET
          "tier" = $2,
          "status" = 'active',
          "startDate" = $3,
          "endDate" = $4,
          "autoRenew" = true,
          "price" = 0,
          "currency" = $5,
          "billingCycle" = 'yearly',
          "familyMembers" = 1,
          "updatedAt" = NOW()
        WHERE "id" = $1
        RETURNING "id"
      `,
      [existing[0].id, TIER, now, endDate, CURRENCY]
    );

    return subscription.id;
  }

  const [subscription] = await queryRunner.query(
    `
      INSERT INTO "subscriptions" (
        "userId",
        "tier",
        "status",
        "planType",
        "startDate",
        "endDate",
        "autoRenew",
        "price",
        "currency",
        "billingCycle",
        "familyMembers"
      )
      VALUES ($1, $2, 'active', 'patient', $3, $4, true, 0, $5, 'yearly', 1)
      RETURNING "id"
    `,
    [userId, TIER, now, endDate, CURRENCY]
  );

  return subscription.id;
}

async function ensurePatientWallet(queryRunner, userId) {
  if (!(await tableExists(queryRunner, "patient_wallets"))) {
    return null;
  }

  const [wallet] = await queryRunner.query(
    `
      INSERT INTO "patient_wallets" (
        "patientId",
        "preferredDisplayCurrency"
      )
      VALUES ($1, $2)
      ON CONFLICT ("patientId") DO UPDATE
      SET
        "preferredDisplayCurrency" = COALESCE(
          "patient_wallets"."preferredDisplayCurrency",
          EXCLUDED."preferredDisplayCurrency"
        ),
        "isActive" = true,
        "updatedAt" = NOW()
      RETURNING "id"
    `,
    [userId, CURRENCY]
  );

  return wallet.id;
}

async function main() {
  assertConfig();

  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const { user, created } = await upsertUser(queryRunner, passwordHash);
    const referralCode = await ensureReferralCode(queryRunner, user);
    const patientProfileId = await ensurePatientProfile(queryRunner, user.id);
    const subscriptionId = await ensureSubscription(queryRunner, user.id);
    const patientWalletId = await ensurePatientWallet(queryRunner, user.id);

    await queryRunner.commitTransaction();

    console.log(created ? "Created testing patient account." : "Updated existing testing patient account.");
    console.log(`Email: ${EMAIL}`);
    console.log(`Password: ${PASSWORD}`);
    console.log(`User ID: ${user.id}`);
    console.log(`Patient profile ID: ${patientProfileId}`);
    console.log(`Referral code: ${referralCode}`);
    if (subscriptionId) console.log(`Subscription ID: ${subscriptionId}`);
    if (patientWalletId) console.log(`Patient wallet ID: ${patientWalletId}`);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error("Failed to create testing patient account:");
  console.error(error);
  process.exit(1);
});
