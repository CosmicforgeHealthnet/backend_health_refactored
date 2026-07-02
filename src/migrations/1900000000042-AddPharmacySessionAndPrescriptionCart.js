module.exports = class AddPharmacySessionAndPrescriptionCart1900000000042 {
    name = "AddPharmacySessionAndPrescriptionCart1900000000042";

    async up(queryRunner) {

        // ── 1. pharmacy_sessions ──────────────────────────────────────────────
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "pharmacy_sessions_status_enum" AS ENUM (
                    'active', 'cart_ready', 'approved', 'expired', 'cancelled'
                );
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "pharmacy_sessions" (
                "id"             UUID        NOT NULL DEFAULT uuid_generate_v4(),
                "prescriptionId" UUID        NOT NULL,
                "pharmacyId"     UUID        NOT NULL,
                "patientId"      UUID        NOT NULL,
                "status"         "pharmacy_sessions_status_enum" NOT NULL DEFAULT 'active',
                "expiresAt"      TIMESTAMP   NOT NULL,
                "createdAt"      TIMESTAMP   NOT NULL DEFAULT now(),
                "updatedAt"      TIMESTAMP   NOT NULL DEFAULT now(),
                CONSTRAINT "PK_pharmacy_sessions" PRIMARY KEY ("id"),
                CONSTRAINT "FK_pharmacy_sessions_prescription" FOREIGN KEY ("prescriptionId")
                    REFERENCES "prescriptions" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_pharmacy_sessions_patient" FOREIGN KEY ("patientId")
                    REFERENCES "users" ("id") ON DELETE RESTRICT
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_sessions_prescriptionId" ON "pharmacy_sessions" ("prescriptionId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_sessions_pharmacyId"     ON "pharmacy_sessions" ("pharmacyId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_sessions_patientId"      ON "pharmacy_sessions" ("patientId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_sessions_status"         ON "pharmacy_sessions" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_pharmacy_sessions_expiresAt"      ON "pharmacy_sessions" ("expiresAt")`);

        // ── 2. prescription_carts ─────────────────────────────────────────────
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "prescription_carts_status_enum" AS ENUM ('building', 'ready', 'approved');
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "prescription_carts_paymentstatus_enum" AS ENUM ('unpaid', 'paid', 'refunded');
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "prescription_carts" (
                "id"                UUID          NOT NULL DEFAULT uuid_generate_v4(),
                "sessionId"         UUID          NOT NULL,
                "prescriptionId"    UUID          NOT NULL,
                "pharmacyId"        UUID          NOT NULL,
                "patientId"         UUID          NOT NULL,
                "status"            "prescription_carts_status_enum"         NOT NULL DEFAULT 'building',
                "totalAmountNgn"    NUMERIC(14,4) DEFAULT NULL,
                "platformFeeNgn"    NUMERIC(14,4) DEFAULT NULL,
                "pharmacyAmountNgn" NUMERIC(14,4) DEFAULT NULL,
                "currency"          VARCHAR(10)   NOT NULL DEFAULT 'NGN',
                "totalAmountUsd"    NUMERIC(14,6) DEFAULT NULL,
                "platformFeeUsd"    NUMERIC(14,6) DEFAULT NULL,
                "pharmacyAmountUsd" NUMERIC(14,6) DEFAULT NULL,
                "exchangeRateToUsd" NUMERIC(14,6) DEFAULT NULL,
                "paymentStatus"     "prescription_carts_paymentstatus_enum"  NOT NULL DEFAULT 'unpaid',
                "paymentReference"  VARCHAR       DEFAULT NULL,
                "paymentProvider"   VARCHAR       DEFAULT NULL,
                "paymentAuthUrl"    VARCHAR       DEFAULT NULL,
                "paidAt"            TIMESTAMP     DEFAULT NULL,
                "pharmacyNote"      TEXT          DEFAULT NULL,
                "createdAt"         TIMESTAMP     NOT NULL DEFAULT now(),
                "updatedAt"         TIMESTAMP     NOT NULL DEFAULT now(),
                CONSTRAINT "PK_prescription_carts"          PRIMARY KEY ("id"),
                CONSTRAINT "UQ_prescription_carts_sessionId" UNIQUE ("sessionId"),
                CONSTRAINT "FK_prescription_carts_session"   FOREIGN KEY ("sessionId")
                    REFERENCES "pharmacy_sessions" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_prescription_carts_sessionId"      ON "prescription_carts" ("sessionId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_prescription_carts_prescriptionId" ON "prescription_carts" ("prescriptionId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_prescription_carts_pharmacyId"     ON "prescription_carts" ("pharmacyId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_prescription_carts_patientId"      ON "prescription_carts" ("patientId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_prescription_carts_paymentStatus"  ON "prescription_carts" ("paymentStatus")`);

        // ── 3. prescription_cart_items ────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "prescription_cart_items" (
                "id"            UUID          NOT NULL DEFAULT uuid_generate_v4(),
                "cartId"        UUID          NOT NULL,
                "productName"   VARCHAR       NOT NULL,
                "quantity"      INTEGER       NOT NULL DEFAULT 1,
                "unitPriceNgn"  NUMERIC(14,4) NOT NULL,
                "totalPriceNgn" NUMERIC(14,4) NOT NULL,
                "note"          TEXT          DEFAULT NULL,
                "isSubstitute"  BOOLEAN       NOT NULL DEFAULT false,
                "createdAt"     TIMESTAMP     NOT NULL DEFAULT now(),
                "updatedAt"     TIMESTAMP     NOT NULL DEFAULT now(),
                CONSTRAINT "PK_prescription_cart_items"      PRIMARY KEY ("id"),
                CONSTRAINT "FK_prescription_cart_items_cart" FOREIGN KEY ("cartId")
                    REFERENCES "prescription_carts" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_prescription_cart_items_cartId" ON "prescription_cart_items" ("cartId")`);

        console.log("✅ Migration AddPharmacySessionAndPrescriptionCart completed successfully.");
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "prescription_cart_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "prescription_carts"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "pharmacy_sessions"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "prescription_carts_paymentstatus_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "prescription_carts_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "pharmacy_sessions_status_enum"`);
    }
};
