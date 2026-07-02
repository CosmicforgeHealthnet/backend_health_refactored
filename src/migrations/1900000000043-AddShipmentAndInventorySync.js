module.exports = class AddShipmentAndInventorySync1900000000043 {
    name = "AddShipmentAndInventorySync1900000000043";

    async up(queryRunner) {

        // ── 1. shipments table ────────────────────────────────────────────────
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "shipments_status_enum" AS ENUM (
                    'pending', 'dispatched', 'in_transit', 'delivered', 'failed'
                );
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "shipments_deliverymethod_enum" AS ENUM ('pickup', 'delivery');
            EXCEPTION WHEN duplicate_object THEN NULL; END $$
        `);
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "shipments" (
                "id"                  UUID        NOT NULL DEFAULT uuid_generate_v4(),
                "orderId"             UUID        NOT NULL,
                "vendorId"            UUID        NOT NULL,
                "patientId"           UUID        NOT NULL,
                "status"              "shipments_status_enum"         NOT NULL DEFAULT 'pending',
                "deliveryMethod"      "shipments_deliverymethod_enum" NOT NULL,
                "deliveryAddress"     TEXT        DEFAULT NULL,
                "trackingNumber"      VARCHAR     DEFAULT NULL,
                "logisticsProvider"   VARCHAR     DEFAULT NULL,
                "estimatedDeliveryAt" TIMESTAMP   DEFAULT NULL,
                "dispatchedAt"        TIMESTAMP   DEFAULT NULL,
                "deliveredAt"         TIMESTAMP   DEFAULT NULL,
                "vendorNotes"         TEXT        DEFAULT NULL,
                "createdAt"           TIMESTAMP   NOT NULL DEFAULT now(),
                "updatedAt"           TIMESTAMP   NOT NULL DEFAULT now(),
                CONSTRAINT "PK_shipments"          PRIMARY KEY ("id"),
                CONSTRAINT "UQ_shipments_orderId"  UNIQUE ("orderId"),
                CONSTRAINT "FK_shipments_order"    FOREIGN KEY ("orderId")
                    REFERENCES "vendor_orders" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_shipments_orderId"        ON "shipments" ("orderId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_shipments_vendorId"       ON "shipments" ("vendorId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_shipments_patientId"      ON "shipments" ("patientId")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_shipments_status"         ON "shipments" ("status")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_shipments_trackingNumber" ON "shipments" ("trackingNumber")`);

        console.log("✅ Migration AddShipmentAndInventorySync completed successfully.");
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "shipments"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "shipments_deliverymethod_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "shipments_status_enum"`);
    }
};
