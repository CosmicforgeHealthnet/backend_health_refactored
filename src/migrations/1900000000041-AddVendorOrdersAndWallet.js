module.exports = class AddVendorOrdersAndWallet1900000000041 {
    name = "AddVendorOrdersAndWallet1900000000041";

    async up(queryRunner) {

        // ── 1. prescriptionRequired on products ──────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "products"
            ADD COLUMN IF NOT EXISTS "prescriptionRequired" boolean NOT NULL DEFAULT false
        `);

        // ── 2. vendor_orders ─────────────────────────────────────────────────
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "vendor_orders_status_enum" AS ENUM (
                    'pending', 'processing', 'completed', 'cancelled'
                );
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "vendor_orders_paymentstatus_enum" AS ENUM (
                    'unpaid', 'paid', 'refunded'
                );
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "vendor_orders" (
                "id"                UUID            NOT NULL DEFAULT uuid_generate_v4(),
                "orderNumber"       VARCHAR(50)     NOT NULL,
                "cartId"            UUID            NOT NULL,
                "vendorId"          UUID            NOT NULL,
                "patientId"         UUID            NOT NULL,
                "status"            "vendor_orders_status_enum"        NOT NULL DEFAULT 'pending',
                "paymentStatus"     "vendor_orders_paymentstatus_enum" NOT NULL DEFAULT 'unpaid',
                "subtotal"          NUMERIC(14,4)   NOT NULL,
                "platformFeeAmount" NUMERIC(14,4)   NOT NULL,
                "vendorAmount"      NUMERIC(14,4)   NOT NULL,
                "currency"          VARCHAR(10)     NOT NULL DEFAULT 'NGN',
                "paymentReference"  VARCHAR         DEFAULT NULL,
                "paymentProvider"   VARCHAR         DEFAULT NULL,
                "paymentAuthUrl"    VARCHAR         DEFAULT NULL,
                "patientNote"       TEXT            DEFAULT NULL,
                "vendorNote"        TEXT            DEFAULT NULL,
                "deliveryMethod"    VARCHAR(20)     DEFAULT NULL,
                "deliveryAddress"   TEXT            DEFAULT NULL,
                "cancelledBy"       VARCHAR(20)     DEFAULT NULL,
                "cancelledAt"       TIMESTAMP       DEFAULT NULL,
                "completedAt"       TIMESTAMP       DEFAULT NULL,
                "paidAt"            TIMESTAMP       DEFAULT NULL,
                "createdAt"         TIMESTAMP       NOT NULL DEFAULT now(),
                "updatedAt"         TIMESTAMP       NOT NULL DEFAULT now(),
                CONSTRAINT "PK_vendor_orders"             PRIMARY KEY ("id"),
                CONSTRAINT "UQ_vendor_orders_orderNumber" UNIQUE ("orderNumber"),
                CONSTRAINT "UQ_vendor_orders_cartId"      UNIQUE ("cartId"),
                CONSTRAINT "FK_vendor_orders_vendor"      FOREIGN KEY ("vendorId")
                    REFERENCES "vendor_profiles" ("id") ON DELETE RESTRICT,
                CONSTRAINT "FK_vendor_orders_patient"     FOREIGN KEY ("patientId")
                    REFERENCES "users" ("id") ON DELETE RESTRICT
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vendor_orders_vendorId"      ON "vendor_orders" ("vendorId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vendor_orders_patientId"     ON "vendor_orders" ("patientId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vendor_orders_cartId"        ON "vendor_orders" ("cartId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vendor_orders_status"        ON "vendor_orders" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vendor_orders_paymentStatus" ON "vendor_orders" ("paymentStatus")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vendor_orders_createdAt"     ON "vendor_orders" ("createdAt")`);

        // ── 3. vendor_wallets ─────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "vendor_wallets" (
                "id"                  UUID          NOT NULL DEFAULT uuid_generate_v4(),
                "vendorId"            UUID          NOT NULL,
                "availableBalanceNgn" NUMERIC(14,4) NOT NULL DEFAULT 0,
                "pendingClearanceNgn" NUMERIC(14,4) NOT NULL DEFAULT 0,
                "totalEarningsNgn"    NUMERIC(14,4) NOT NULL DEFAULT 0,
                "isActive"            BOOLEAN       NOT NULL DEFAULT true,
                "isFrozen"            BOOLEAN       NOT NULL DEFAULT false,
                "frozenReason"        TEXT          DEFAULT NULL,
                "lastPayoutAt"        TIMESTAMP     DEFAULT NULL,
                "createdAt"           TIMESTAMP     NOT NULL DEFAULT now(),
                "updatedAt"           TIMESTAMP     NOT NULL DEFAULT now(),
                CONSTRAINT "PK_vendor_wallets"          PRIMARY KEY ("id"),
                CONSTRAINT "UQ_vendor_wallets_vendorId" UNIQUE ("vendorId"),
                CONSTRAINT "FK_vendor_wallets_vendor"   FOREIGN KEY ("vendorId")
                    REFERENCES "vendor_profiles" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vendor_wallets_vendorId" ON "vendor_wallets" ("vendorId")`);

        // ── 4. vendor_wallet_transactions ─────────────────────────────────────
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "vendor_wallet_transactions_type_enum" AS ENUM ('credit', 'debit');
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "vendor_wallet_transactions_category_enum" AS ENUM (
                    'order_payment', 'payout', 'refund', 'adjustment'
                );
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "vendor_wallet_transactions_status_enum" AS ENUM (
                    'completed', 'pending', 'failed'
                );
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "vendor_wallet_transactions" (
                "id"              UUID          NOT NULL DEFAULT uuid_generate_v4(),
                "walletId"        UUID          NOT NULL,
                "vendorId"        UUID          NOT NULL,
                "type"            "vendor_wallet_transactions_type_enum"     NOT NULL,
                "category"        "vendor_wallet_transactions_category_enum" NOT NULL,
                "status"          "vendor_wallet_transactions_status_enum"   NOT NULL DEFAULT 'completed',
                "amountNgn"       NUMERIC(14,4) NOT NULL,
                "balanceAfterNgn" NUMERIC(14,4) NOT NULL,
                "orderId"         UUID          DEFAULT NULL,
                "reference"       VARCHAR       DEFAULT NULL,
                "description"     TEXT          NOT NULL,
                "createdAt"       TIMESTAMP     NOT NULL DEFAULT now(),
                "updatedAt"       TIMESTAMP     NOT NULL DEFAULT now(),
                CONSTRAINT "PK_vendor_wallet_transactions"        PRIMARY KEY ("id"),
                CONSTRAINT "FK_vendor_wallet_transactions_wallet" FOREIGN KEY ("walletId")
                    REFERENCES "vendor_wallets" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vendor_wallet_txn_walletId"  ON "vendor_wallet_transactions" ("walletId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vendor_wallet_txn_vendorId"  ON "vendor_wallet_transactions" ("vendorId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vendor_wallet_txn_orderId"   ON "vendor_wallet_transactions" ("orderId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vendor_wallet_txn_category"  ON "vendor_wallet_transactions" ("category")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_vendor_wallet_txn_createdAt" ON "vendor_wallet_transactions" ("createdAt")`);

        console.log("✅ Migration AddVendorOrdersAndWallet completed successfully.");
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "vendor_wallet_transactions"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "vendor_wallets"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "vendor_orders"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_wallet_transactions_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_wallet_transactions_category_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_wallet_transactions_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_orders_paymentstatus_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_orders_status_enum"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "prescriptionRequired"`);
    }
};
