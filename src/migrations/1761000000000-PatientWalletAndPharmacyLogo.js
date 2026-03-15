/**
 * Migration: PatientWalletAndPharmacyLogo
 *
 * Creates:
 *  - patient_wallet_txn_type_enum
 *  - patient_wallet_txn_status_enum
 *  - patient_wallet_txn_category_enum
 *  - patient_wallets table
 *  - patient_wallet_transactions table
 *
 * Alters:
 *  - pharmacy_profiles: adds logo_url column
 */
module.exports = class PatientWalletAndPharmacyLogo1761000000000 {
  name = "PatientWalletAndPharmacyLogo1761000000000";

  async up(queryRunner) {
    // ─── Enums ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE patient_wallet_txn_type_enum AS ENUM ('credit', 'debit');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE patient_wallet_txn_status_enum AS ENUM ('pending', 'completed', 'failed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE patient_wallet_txn_category_enum AS ENUM ('payment', 'top_up', 'refund', 'adjustment');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // ─── patient_wallets ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_wallets" (
        "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId"                UUID NOT NULL UNIQUE,
        "balanceUsd"               DECIMAL(14,4) NOT NULL DEFAULT 0,
        "totalSpentUsd"            DECIMAL(14,4) NOT NULL DEFAULT 0,
        "totalTopUpsUsd"           DECIMAL(14,4) NOT NULL DEFAULT 0,
        "preferredDisplayCurrency" VARCHAR(3)    NOT NULL DEFAULT 'USD',
        "isActive"                 BOOLEAN       NOT NULL DEFAULT true,
        "createdAt"                TIMESTAMP     NOT NULL DEFAULT now(),
        "updatedAt"                TIMESTAMP     NOT NULL DEFAULT now(),
        CONSTRAINT "fk_patient_wallets_patient"
          FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_patient_wallets_patientId"
        ON "patient_wallets" ("patientId");
    `);

    // ─── patient_wallet_transactions ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_wallet_transactions" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "walletId"         UUID        NOT NULL,
        "type"             patient_wallet_txn_type_enum     NOT NULL,
        "status"           patient_wallet_txn_status_enum   NOT NULL DEFAULT 'pending',
        "category"         patient_wallet_txn_category_enum NOT NULL,
        "amountUsd"        DECIMAL(14,4) NOT NULL,
        "reference"        VARCHAR(255)  UNIQUE,
        "authorizationUrl" TEXT,
        "provider"         VARCHAR(50),
        "description"      TEXT,
        "metadata"         JSONB,
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_patient_wallet_transactions_wallet"
          FOREIGN KEY ("walletId") REFERENCES "patient_wallets"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_patient_wallet_txn_walletId"
        ON "patient_wallet_transactions" ("walletId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_patient_wallet_txn_reference"
        ON "patient_wallet_transactions" ("reference");
    `);

    // ─── pharmacy_profiles: add logo_url ─────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "pharmacy_profiles"
        ADD COLUMN IF NOT EXISTS "logoUrl" VARCHAR;
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`ALTER TABLE "pharmacy_profiles" DROP COLUMN IF EXISTS "logoUrl";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_wallet_transactions";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_wallets";`);
    await queryRunner.query(`DROP TYPE IF EXISTS patient_wallet_txn_category_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS patient_wallet_txn_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS patient_wallet_txn_type_enum;`);
  }
};
