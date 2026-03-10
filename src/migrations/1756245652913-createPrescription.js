// /**
//  * @typedef {import('typeorm').MigrationInterface} MigrationInterface
//  */

// /**
//  * @class
//  * @implements {MigrationInterface}
//  */
// module.exports = class CreatePrescription1756245652913 {
//     name = 'CreatePrescription1756245652913'

//     async up(queryRunner) {
//         await queryRunner.query(`CREATE TYPE "public"."prescriptions_status_enum" AS ENUM('pending', 'patient_uploaded', 'pharmacy_assigned', 'pharmacy_processing', 'ready_for_pickup', 'ready_for_delivery', 'completed', 'cancelled')`);
//         await queryRunner.query(`CREATE TYPE "public"."prescriptions_paymentmethod_enum" AS ENUM('online', 'payOnPickup')`);
//         await queryRunner.query(`CREATE TYPE "public"."prescriptions_paymentstatus_enum" AS ENUM('unpaid', 'paid', 'cancelled')`);
//         await queryRunner.query(`CREATE TABLE IF NOT EXISTS "prescriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reference" character varying NOT NULL, "doctorId" uuid NOT NULL, "patientId" uuid NOT NULL, "pharmacyId" uuid, "consultationId" uuid, "medications" json NOT NULL, "status" "public"."prescriptions_status_enum" NOT NULL DEFAULT 'pending', "assignedPharmacistId" uuid, "fulfillmentHistory" json, "invoiceItems" json, "deliveryFee" numeric(10,2) DEFAULT '0', "totalDue" numeric(10,2), "paymentMethod" "public"."prescriptions_paymentmethod_enum", "paymentStatus" "public"."prescriptions_paymentstatus_enum" NOT NULL DEFAULT 'unpaid', "chatMessages" json, "doctorNotes" text, "pharmacyNotes" text, "patientNotes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deliveryAddress" text, "deliveryInstructions" text, "expectedDeliveryDate" TIMESTAMP, "actualDeliveryDate" TIMESTAMP, CONSTRAINT "UQ_5f680454c70e6b2134c5ddc6d13" UNIQUE ("reference"), CONSTRAINT "PK_097b2cc2f2b7e56825468188503" PRIMARY KEY ("id")); COMMENT ON COLUMN "prescriptions"."reference" IS 'Prescription reference code (e.g., RX-20250821-001)'; COMMENT ON COLUMN "prescriptions"."medications" IS 'Array of prescribed medications with dosage, frequency, duration, notes, quantity'; COMMENT ON COLUMN "prescriptions"."fulfillmentHistory" IS 'Array of status changes with timestamps'; COMMENT ON COLUMN "prescriptions"."invoiceItems" IS 'Array of medication costs calculated by pharmacy'; COMMENT ON COLUMN "prescriptions"."chatMessages" IS 'Chat messages between patient and pharmacy'`);
//         await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_42c70415fad4505386e6d7e9dc" ON "prescriptions" ("doctorId") `);
//         await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_51f48335657278b20348dde416" ON "prescriptions" ("patientId") `);
//         await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_5be0de38aef377b8ba2bc94606" ON "prescriptions" ("pharmacyId") `);
//         await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_5f680454c70e6b2134c5ddc6d1" ON "prescriptions" ("reference") `);
//         await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_414e0cee0efdee5a65a2bad9cd" ON "prescriptions" ("status") `);
//         await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_807c3cba73fd06d0f2a680821a" ON "prescriptions" ("paymentStatus") `);
//         await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_34c9597360c36e1993831cce65" ON "prescriptions" ("createdAt") `);
//         await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_29fe8d9d7fd15107817912ff60" ON "prescriptions" ("consultationId") `);
//         await queryRunner.query(`ALTER TABLE "prescriptions" ADD CONSTRAINT "FK_42c70415fad4505386e6d7e9dc4" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
//         await queryRunner.query(`ALTER TABLE "prescriptions" ADD CONSTRAINT "FK_51f48335657278b20348dde416c" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
//         await queryRunner.query(`ALTER TABLE "prescriptions" ADD CONSTRAINT "FK_5be0de38aef377b8ba2bc94606e" FOREIGN KEY ("pharmacyId") REFERENCES "pharmacy_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
//         await queryRunner.query(`ALTER TABLE "prescriptions" ADD CONSTRAINT "FK_2345a2f6eb9dee50970bfcb4bbd" FOREIGN KEY ("assignedPharmacistId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
//     }

//     async down(queryRunner) {
//         await queryRunner.query(`ALTER TABLE "prescriptions" DROP CONSTRAINT "FK_2345a2f6eb9dee50970bfcb4bbd"`);
//         await queryRunner.query(`ALTER TABLE "prescriptions" DROP CONSTRAINT "FK_5be0de38aef377b8ba2bc94606e"`);
//         await queryRunner.query(`ALTER TABLE "prescriptions" DROP CONSTRAINT "FK_51f48335657278b20348dde416c"`);
//         await queryRunner.query(`ALTER TABLE "prescriptions" DROP CONSTRAINT "FK_42c70415fad4505386e6d7e9dc4"`);
//         await queryRunner.query(`DROP INDEX "public"."IDX_29fe8d9d7fd15107817912ff60"`);
//         await queryRunner.query(`DROP INDEX "public"."IDX_34c9597360c36e1993831cce65"`);
//         await queryRunner.query(`DROP INDEX "public"."IDX_807c3cba73fd06d0f2a680821a"`);
//         await queryRunner.query(`DROP INDEX "public"."IDX_414e0cee0efdee5a65a2bad9cd"`);
//         await queryRunner.query(`DROP INDEX "public"."IDX_5f680454c70e6b2134c5ddc6d1"`);
//         await queryRunner.query(`DROP INDEX "public"."IDX_5be0de38aef377b8ba2bc94606"`);
//         await queryRunner.query(`DROP INDEX "public"."IDX_51f48335657278b20348dde416"`);
//         await queryRunner.query(`DROP INDEX "public"."IDX_42c70415fad4505386e6d7e9dc"`);
//         await queryRunner.query(`DROP TABLE "prescriptions"`);
//         await queryRunner.query(`DROP TYPE "public"."prescriptions_paymentstatus_enum"`);
//         await queryRunner.query(`DROP TYPE "public"."prescriptions_paymentmethod_enum"`);
//         await queryRunner.query(`DROP TYPE "public"."prescriptions_status_enum"`);
//     }
// }
