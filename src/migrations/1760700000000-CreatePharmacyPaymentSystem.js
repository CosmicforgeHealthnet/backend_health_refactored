/**
 * Migration: CreatePharmacyPaymentSystem
 *
 * Creates all tables for the pharmacy payment & wallet system:
 *  - invoices
 *  - invoice_line_items
 *  - pharmacy_wallets
 *  - pharmacy_wallet_transactions
 *  - pharmacy_bank_accounts
 *  - pharmacy_payout_requests
 *  - pharmacy_payments
 *  - pharmacy_disputes
 *
 * Also adds new prescription statuses to the prescriptions_status_enum
 * (under_review, awaiting_payment, in_progress).
 */
module.exports = class CreatePharmacyPaymentSystem1760700000000 {
  name = "CreatePharmacyPaymentSystem1760700000000";

  async up(queryRunner) {
    // ─── Extend prescription status enum ────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE prescriptions_status_enum ADD VALUE IF NOT EXISTS 'under_review';
        ALTER TYPE prescriptions_status_enum ADD VALUE IF NOT EXISTS 'awaiting_payment';
        ALTER TYPE prescriptions_status_enum ADD VALUE IF NOT EXISTS 'in_progress';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // ─── Enums ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE invoice_payment_method_enum AS ENUM ('online', 'pay_on_pickup');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE invoice_status_enum AS ENUM (
          'draft', 'sent', 'viewed', 'awaiting_payment', 'paid', 'overdue', 'cancelled'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE wallet_txn_type_enum AS ENUM ('credit', 'debit');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE wallet_txn_status_enum AS ENUM (
          'completed', 'pending', 'processing', 'failed', 'reversed'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE wallet_txn_category_enum AS ENUM (
          'invoice_payment', 'payout', 'refund', 'dispute_reversal', 'adjustment'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE payout_status_enum AS ENUM (
          'pending', 'processing', 'completed', 'failed', 'cancelled'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE pharmacy_payment_status_enum AS ENUM ('pending', 'success', 'failed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE payment_provider_enum AS ENUM ('paystack', 'flutterwave');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE dispute_status_enum AS ENUM (
          'open', 'under_review', 'resolved', 'escalated', 'closed'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE dispute_resolution_enum AS ENUM (
          'pharmacy_favour', 'patient_favour', 'split', 'pending'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE dispute_raised_by_enum AS ENUM ('patient', 'pharmacy');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // ─── invoices ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id"                  UUID NOT NULL DEFAULT uuid_generate_v4(),
        "reference"           VARCHAR(20) NOT NULL,
        "prescriptionId"      UUID NOT NULL,
        "pharmacyId"          UUID NOT NULL,
        "patientId"           UUID NOT NULL,
        "subtotalUsd"         DECIMAL(14,4) NOT NULL DEFAULT 0,
        "deliveryFeeUsd"      DECIMAL(14,4) NOT NULL DEFAULT 0,
        "totalAmountUsd"      DECIMAL(14,4) NOT NULL DEFAULT 0,
        "displayCurrency"     VARCHAR(3)  NOT NULL DEFAULT 'USD',
        "exchangeRateToUsd"   DECIMAL(18,6) NOT NULL DEFAULT 1,
        "paymentMethod"       invoice_payment_method_enum NOT NULL,
        "status"              invoice_status_enum NOT NULL DEFAULT 'draft',
        "paidAt"              TIMESTAMP,
        "dueAt"               TIMESTAMP,
        "notes"               TEXT,
        "createdAt"           TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt"           TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_invoices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invoices_ref_pharmacy" UNIQUE ("reference", "pharmacyId"),
        CONSTRAINT "FK_invoices_prescription" FOREIGN KEY ("prescriptionId")
          REFERENCES "prescriptions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invoices_patient" FOREIGN KEY ("patientId")
          REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_pharmacyId"    ON "invoices" ("pharmacyId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_patientId"     ON "invoices" ("patientId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_prescriptionId" ON "invoices" ("prescriptionId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_status"        ON "invoices" ("status");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_createdAt"     ON "invoices" ("createdAt");`);

    // ─── invoice_line_items ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoice_line_items" (
        "id"              UUID NOT NULL DEFAULT uuid_generate_v4(),
        "invoiceId"       UUID NOT NULL,
        "medicationName"  VARCHAR(255) NOT NULL,
        "dosage"          VARCHAR(100),
        "quantity"        INT NOT NULL,
        "unitPriceUsd"    DECIMAL(14,4) NOT NULL,
        "subtotalUsd"     DECIMAL(14,4) NOT NULL,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_invoice_line_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invoice_line_items_invoice" FOREIGN KEY ("invoiceId")
          REFERENCES "invoices"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoice_line_items_invoiceId" ON "invoice_line_items" ("invoiceId");`);

    // ─── pharmacy_wallets ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pharmacy_wallets" (
        "id"                       UUID NOT NULL DEFAULT uuid_generate_v4(),
        "pharmacyId"               UUID NOT NULL,
        "availableBalanceUsd"      DECIMAL(14,4) NOT NULL DEFAULT 0,
        "pendingClearanceUsd"      DECIMAL(14,4) NOT NULL DEFAULT 0,
        "totalEarningsUsd"         DECIMAL(14,4) NOT NULL DEFAULT 0,
        "preferredDisplayCurrency" VARCHAR(3)  NOT NULL DEFAULT 'USD',
        "isActive"                 BOOLEAN NOT NULL DEFAULT TRUE,
        "isFrozen"                 BOOLEAN NOT NULL DEFAULT FALSE,
        "frozenReason"             VARCHAR(500),
        "lastPayoutAt"             TIMESTAMP,
        "createdAt"                TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt"                TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_pharmacy_wallets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pharmacy_wallets_pharmacyId" UNIQUE ("pharmacyId"),
        CONSTRAINT "FK_pharmacy_wallets_pharmacy" FOREIGN KEY ("pharmacyId")
          REFERENCES "pharmacy_profiles"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_wallets_pharmacyId" ON "pharmacy_wallets" ("pharmacyId");`);

    // ─── pharmacy_wallet_transactions ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pharmacy_wallet_transactions" (
        "id"              UUID NOT NULL DEFAULT uuid_generate_v4(),
        "walletId"        UUID NOT NULL,
        "pharmacyId"      UUID NOT NULL,
        "type"            wallet_txn_type_enum NOT NULL,
        "status"          wallet_txn_status_enum NOT NULL DEFAULT 'pending',
        "category"        wallet_txn_category_enum NOT NULL,
        "amountUsd"       DECIMAL(14,4) NOT NULL,
        "balanceAfterUsd" DECIMAL(14,4) NOT NULL,
        "description"     VARCHAR(500) NOT NULL,
        "reference"       VARCHAR(100) NOT NULL,
        "invoiceId"       UUID,
        "invoiceRef"      VARCHAR(30),
        "patientId"       UUID,
        "prescriptionId"  UUID,
        "payoutRequestId" UUID,
        "settledAt"       TIMESTAMP,
        "createdAt"       TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt"       TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_pharmacy_wallet_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pharmacy_wallet_txn_wallet" FOREIGN KEY ("walletId")
          REFERENCES "pharmacy_wallets"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharm_wallet_txn_walletId"   ON "pharmacy_wallet_transactions" ("walletId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharm_wallet_txn_pharmacyId" ON "pharmacy_wallet_transactions" ("pharmacyId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharm_wallet_txn_status"     ON "pharmacy_wallet_transactions" ("status");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharm_wallet_txn_category"   ON "pharmacy_wallet_transactions" ("category");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharm_wallet_txn_createdAt"  ON "pharmacy_wallet_transactions" ("createdAt");`);

    // ─── pharmacy_bank_accounts ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pharmacy_bank_accounts" (
        "id"            UUID NOT NULL DEFAULT uuid_generate_v4(),
        "pharmacyId"    UUID NOT NULL,
        "walletId"      UUID NOT NULL,
        "bankName"      VARCHAR(100) NOT NULL,
        "accountNumber" VARCHAR(20)  NOT NULL,
        "accountName"   VARCHAR(255) NOT NULL,
        "bankCode"      VARCHAR(10)  NOT NULL,
        "recipientCode" VARCHAR(100),
        "isDefault"     BOOLEAN NOT NULL DEFAULT FALSE,
        "isActive"      BOOLEAN NOT NULL DEFAULT TRUE,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_pharmacy_bank_accounts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pharmacy_bank_account" UNIQUE ("accountNumber", "bankCode", "pharmacyId"),
        CONSTRAINT "FK_pharmacy_bank_acct_wallet" FOREIGN KEY ("walletId")
          REFERENCES "pharmacy_wallets"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_bank_acct_pharmacyId" ON "pharmacy_bank_accounts" ("pharmacyId");`);

    // ─── pharmacy_payout_requests ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pharmacy_payout_requests" (
        "id"            UUID NOT NULL DEFAULT uuid_generate_v4(),
        "pharmacyId"    UUID NOT NULL,
        "walletId"      UUID NOT NULL,
        "bankAccountId" UUID NOT NULL,
        "amountUsd"     DECIMAL(14,4) NOT NULL,
        "status"        payout_status_enum NOT NULL DEFAULT 'pending',
        "reference"     VARCHAR(100) NOT NULL,
        "transferCode"  VARCHAR(100),
        "note"          VARCHAR(500),
        "failureReason" VARCHAR(500),
        "requestedAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
        "processedAt"   TIMESTAMP,
        "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_pharmacy_payout_requests" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pharmacy_payout_reference" UNIQUE ("reference"),
        CONSTRAINT "FK_pharmacy_payout_wallet" FOREIGN KEY ("walletId")
          REFERENCES "pharmacy_wallets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pharmacy_payout_bank_acct" FOREIGN KEY ("bankAccountId")
          REFERENCES "pharmacy_bank_accounts"("id") ON DELETE RESTRICT
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_payout_pharmacyId" ON "pharmacy_payout_requests" ("pharmacyId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_payout_status"     ON "pharmacy_payout_requests" ("status");`);

    // ─── pharmacy_payments ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pharmacy_payments" (
        "id"                UUID NOT NULL DEFAULT uuid_generate_v4(),
        "invoiceId"         UUID NOT NULL,
        "patientId"         UUID NOT NULL,
        "pharmacyId"        UUID NOT NULL,
        "reference"         VARCHAR(100) NOT NULL,
        "amountLocal"       DECIMAL(14,4) NOT NULL,
        "currency"          VARCHAR(3)  NOT NULL,
        "exchangeRate"      DECIMAL(18,6) NOT NULL DEFAULT 1,
        "amountUsd"         DECIMAL(14,4) NOT NULL,
        "status"            pharmacy_payment_status_enum NOT NULL DEFAULT 'pending',
        "provider"          payment_provider_enum NOT NULL,
        "authorizationUrl"  VARCHAR(500),
        "providerReference" VARCHAR(200),
        "metadata"          JSONB,
        "createdAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_pharmacy_payments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pharmacy_payment_reference" UNIQUE ("reference"),
        CONSTRAINT "FK_pharmacy_payment_invoice" FOREIGN KEY ("invoiceId")
          REFERENCES "invoices"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_payment_invoiceId"         ON "pharmacy_payments" ("invoiceId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_payment_reference"         ON "pharmacy_payments" ("reference");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_payment_providerReference" ON "pharmacy_payments" ("providerReference");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_payment_status"            ON "pharmacy_payments" ("status");`);

    // ─── pharmacy_disputes ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pharmacy_disputes" (
        "id"                  UUID NOT NULL DEFAULT uuid_generate_v4(),
        "invoiceId"           UUID NOT NULL,
        "pharmacyId"          UUID NOT NULL,
        "patientId"           UUID NOT NULL,
        "amountUsd"           DECIMAL(14,4) NOT NULL,
        "status"              dispute_status_enum NOT NULL DEFAULT 'open',
        "resolution"          dispute_resolution_enum DEFAULT 'pending',
        "reason"              VARCHAR(255) NOT NULL,
        "description"         TEXT NOT NULL,
        "raisedBy"            dispute_raised_by_enum NOT NULL,
        "pharmacyResponse"    TEXT,
        "pharmacyResponseAt"  TIMESTAMP,
        "resolvedAt"          TIMESTAMP,
        "createdAt"           TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt"           TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_pharmacy_disputes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pharmacy_dispute_invoice" FOREIGN KEY ("invoiceId")
          REFERENCES "invoices"("id") ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_dispute_invoiceId"  ON "pharmacy_disputes" ("invoiceId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_dispute_pharmacyId" ON "pharmacy_disputes" ("pharmacyId");`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_dispute_status"     ON "pharmacy_disputes" ("status");`);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "pharmacy_disputes" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pharmacy_payments" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pharmacy_payout_requests" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pharmacy_bank_accounts" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pharmacy_wallet_transactions" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pharmacy_wallets" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoice_line_items" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices" CASCADE;`);

    await queryRunner.query(`DROP TYPE IF EXISTS dispute_raised_by_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS dispute_resolution_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS dispute_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS payment_provider_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS pharmacy_payment_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS payout_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS wallet_txn_category_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS wallet_txn_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS wallet_txn_type_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS invoice_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS invoice_payment_method_enum;`);
  }
};
