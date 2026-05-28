/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddVendorShopSystem1900000000040 {
    name = 'AddVendorShopSystem1900000000040'

    async up(queryRunner) {
        // ── 1. Extend existing users enums ──────────────────────────────────────
        await queryRunner.query(`ALTER TYPE "users_status_enum" ADD VALUE IF NOT EXISTS 'pending_vendor_verification'`);
        await queryRunner.query(`ALTER TYPE "users_status_enum" ADD VALUE IF NOT EXISTS 'vendor_active'`);
        await queryRunner.query(`ALTER TYPE "users_role_enum"   ADD VALUE IF NOT EXISTS 'vendor'`);

        // ── 2. vendor_profiles ──────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "vendor_profiles_businesscategory_enum" AS ENUM (
                'health_wellness', 'medical_supplies', 'baby_mother_care',
                'fitness_lifestyle', 'nutrition_healthy_living', 'others'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "vendor_profiles_verificationstatus_enum" AS ENUM (
                'pending', 'documents_required', 'under_review', 'approved', 'rejected', 'suspended'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "vendor_profiles" (
                "id"                      uuid                                       NOT NULL DEFAULT uuid_generate_v4(),
                "userId"                  uuid                                       NOT NULL,
                "businessName"            character varying                          NOT NULL,
                "businessCategory"        "vendor_profiles_businesscategory_enum"    NOT NULL,
                "businessEmail"           character varying                          NOT NULL,
                "businessPhone"           character varying                          NOT NULL,
                "country"                 character varying(100)                     NOT NULL,
                "state"                   character varying(100)                     NOT NULL,
                "city"                    character varying(100)                     NOT NULL,
                "fullAddress"             text                                       NOT NULL,
                "businessWebsite"         character varying,
                "businessDescription"     text                                       NOT NULL,
                "logoUrl"                 character varying,
                "verificationStatus"      "vendor_profiles_verificationstatus_enum"  NOT NULL DEFAULT 'pending',
                "isActive"                boolean                                    NOT NULL DEFAULT false,
                "documentsSubmitted"      boolean                                    NOT NULL DEFAULT false,
                "isHybridPharmacy"        boolean                                    NOT NULL DEFAULT false,
                "pharmacyProfileId"       uuid,
                "notificationPreferences" json,
                "createdAt"               TIMESTAMP                                  NOT NULL DEFAULT now(),
                "updatedAt"               TIMESTAMP                                  NOT NULL DEFAULT now(),
                CONSTRAINT "PK_vendor_profiles"        PRIMARY KEY ("id"),
                CONSTRAINT "UQ_vendor_profiles_userId" UNIQUE ("userId")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_vendor_profiles_userId"             ON "vendor_profiles" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_vendor_profiles_verificationStatus" ON "vendor_profiles" ("verificationStatus")`);
        await queryRunner.query(`CREATE INDEX "IDX_vendor_profiles_businessCategory"   ON "vendor_profiles" ("businessCategory")`);
        await queryRunner.query(`CREATE INDEX "IDX_vendor_profiles_isHybridPharmacy"   ON "vendor_profiles" ("isHybridPharmacy")`);

        // ── 3. vendor_documents ─────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "vendor_documents_documenttype_enum"       AS ENUM ('government_id', 'business_registration')
        `);
        await queryRunner.query(`
            CREATE TYPE "vendor_documents_verificationstatus_enum" AS ENUM ('pending', 'approved', 'rejected')
        `);
        await queryRunner.query(`
            CREATE TABLE "vendor_documents" (
                "id"                 uuid                                        NOT NULL DEFAULT uuid_generate_v4(),
                "vendorId"           uuid                                        NOT NULL,
                "documentType"       "vendor_documents_documenttype_enum"        NOT NULL,
                "documentUrl"        character varying                           NOT NULL,
                "fileName"           character varying,
                "mimeType"           character varying,
                "verificationStatus" "vendor_documents_verificationstatus_enum"  NOT NULL DEFAULT 'pending',
                "createdAt"          TIMESTAMP                                   NOT NULL DEFAULT now(),
                "updatedAt"          TIMESTAMP                                   NOT NULL DEFAULT now(),
                CONSTRAINT "PK_vendor_documents"        PRIMARY KEY ("id"),
                CONSTRAINT "FK_vendor_documents_vendor" FOREIGN KEY ("vendorId") REFERENCES "vendor_profiles" ("id") ON DELETE CASCADE
            )
        `);

        // ── 4. vendor_verification_requests ────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "vendor_verification_requests_requesttype_enum" AS ENUM (
                'initial_verification', 're_verification', 'document_update'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "vendor_verification_requests_status_enum" AS ENUM (
                'pending', 'in_progress', 'approved', 'rejected', 'requires_changes'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "vendor_verification_requests_priority_enum" AS ENUM ('low', 'medium', 'high', 'urgent')
        `);
        await queryRunner.query(`
            CREATE TABLE "vendor_verification_requests" (
                "id"              uuid                                              NOT NULL DEFAULT uuid_generate_v4(),
                "vendorId"        uuid                                              NOT NULL,
                "requestType"     "vendor_verification_requests_requesttype_enum"  NOT NULL DEFAULT 'initial_verification',
                "status"          "vendor_verification_requests_status_enum"        NOT NULL DEFAULT 'pending',
                "priority"        "vendor_verification_requests_priority_enum"      NOT NULL DEFAULT 'medium',
                "requestNotes"    text,
                "rejectionReason" text,
                "reviewNotes"     text,
                "assignedTo"      uuid,
                "reviewedBy"      uuid,
                "submittedAt"     TIMESTAMP,
                "assignedAt"      TIMESTAMP,
                "reviewedAt"      TIMESTAMP,
                "completedAt"     TIMESTAMP,
                "createdAt"       TIMESTAMP                                         NOT NULL DEFAULT now(),
                "updatedAt"       TIMESTAMP                                         NOT NULL DEFAULT now(),
                CONSTRAINT "PK_vendor_verification_requests"        PRIMARY KEY ("id"),
                CONSTRAINT "FK_vendor_verification_requests_vendor" FOREIGN KEY ("vendorId") REFERENCES "vendor_profiles" ("id") ON DELETE CASCADE
            )
        `);

        // ── 5. products ─────────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "products_category_enum" AS ENUM (
                'health_wellness', 'medical_supplies', 'baby_mother_care',
                'fitness_lifestyle', 'nutrition_healthy_living', 'others', 'medications'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "products_subcategory_enum" AS ENUM (
                'skincare_beauty', 'hair_body_care', 'personal_hygiene', 'sexual_wellness', 'men_women_care',
                'first_aid_kits', 'diagnostic_tools', 'mobility_aids', 'surgical_disposable_supplies',
                'baby_food', 'diapers_wipes', 'baby_clothing_care', 'nursing_maternity_products',
                'home_workout_equipment', 'sports_accessories', 'smart_watches_trackers', 'weight_management_nutrition',
                'vitamins_supplements', 'herbal_natural_remedies', 'energy_performance_products', 'healthy_snacks_drinks',
                'health_gadgets_devices', 'home_care_cleaning_essentials', 'protective_safety_items', 'aromatherapy_essential_oils',
                'prescription_drugs', 'over_the_counter', 'vitamins_otc', 'topical_medications'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "products_status_enum" AS ENUM ('pending', 'approved', 'failed')
        `);
        await queryRunner.query(`
            CREATE TABLE "products" (
                "id"              uuid                        NOT NULL DEFAULT uuid_generate_v4(),
                "vendorId"        uuid                        NOT NULL,
                "title"           character varying           NOT NULL,
                "description"     text                        NOT NULL,
                "price"           numeric(12,2)               NOT NULL,
                "stockQuantity"   integer                     NOT NULL DEFAULT 0,
                "category"        "products_category_enum"    NOT NULL,
                "subcategory"     "products_subcategory_enum" NOT NULL,
                "status"          "products_status_enum"      NOT NULL DEFAULT 'pending',
                "rejectionReason" text,
                "isActive"        boolean                     NOT NULL DEFAULT true,
                "createdAt"       TIMESTAMP                   NOT NULL DEFAULT now(),
                "updatedAt"       TIMESTAMP                   NOT NULL DEFAULT now(),
                CONSTRAINT "PK_products"        PRIMARY KEY ("id"),
                CONSTRAINT "FK_products_vendor" FOREIGN KEY ("vendorId") REFERENCES "vendor_profiles" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_products_vendorId"  ON "products" ("vendorId")`);
        await queryRunner.query(`CREATE INDEX "IDX_products_status"    ON "products" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_products_category"  ON "products" ("category")`);
        await queryRunner.query(`CREATE INDEX "IDX_products_isActive"  ON "products" ("isActive")`);

        // ── 6. product_media ────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "product_media_mediatype_enum" AS ENUM ('image', 'video')
        `);
        await queryRunner.query(`
            CREATE TABLE "product_media" (
                "id"        uuid                          NOT NULL DEFAULT uuid_generate_v4(),
                "productId" uuid                          NOT NULL,
                "mediaUrl"  character varying             NOT NULL,
                "mediaType" "product_media_mediatype_enum" NOT NULL DEFAULT 'image',
                "isPrimary" boolean                       NOT NULL DEFAULT false,
                "createdAt" TIMESTAMP                     NOT NULL DEFAULT now(),
                CONSTRAINT "PK_product_media"         PRIMARY KEY ("id"),
                CONSTRAINT "FK_product_media_product" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_product_media_productId" ON "product_media" ("productId")`);

        // ── 7. carts ────────────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "carts_status_enum" AS ENUM ('draft', 'submitted', 'confirmed', 'cancelled')
        `);
        await queryRunner.query(`
            CREATE TABLE "carts" (
                "id"             uuid                 NOT NULL DEFAULT uuid_generate_v4(),
                "patientId"      uuid                 NOT NULL,
                "vendorId"       uuid                 NOT NULL,
                "status"         "carts_status_enum"  NOT NULL DEFAULT 'draft',
                "patientNote"    text,
                "vendorNote"     text,
                "confirmedTotal" numeric(12,2),
                "submittedAt"    TIMESTAMP,
                "confirmedAt"    TIMESTAMP,
                "cancelledAt"    TIMESTAMP,
                "cancelledBy"    character varying,
                "createdAt"      TIMESTAMP            NOT NULL DEFAULT now(),
                "updatedAt"      TIMESTAMP            NOT NULL DEFAULT now(),
                CONSTRAINT "PK_carts" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_carts_patientId"          ON "carts" ("patientId")`);
        await queryRunner.query(`CREATE INDEX "IDX_carts_vendorId"           ON "carts" ("vendorId")`);
        await queryRunner.query(`CREATE INDEX "IDX_carts_status"             ON "carts" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_carts_patientId_vendorId" ON "carts" ("patientId", "vendorId")`);

        // ── 8. cart_items ───────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "cart_items" (
                "id"            uuid          NOT NULL DEFAULT uuid_generate_v4(),
                "cartId"        uuid          NOT NULL,
                "productId"     uuid          NOT NULL,
                "quantity"      integer       NOT NULL DEFAULT 1,
                "priceSnapshot" numeric(12,2) NOT NULL,
                "productTitle"  character varying NOT NULL,
                "createdAt"     TIMESTAMP     NOT NULL DEFAULT now(),
                "updatedAt"     TIMESTAMP     NOT NULL DEFAULT now(),
                CONSTRAINT "PK_cart_items"         PRIMARY KEY ("id"),
                CONSTRAINT "FK_cart_items_cart"    FOREIGN KEY ("cartId")    REFERENCES "carts"    ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_cart_items_product" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_cart_items_cartId"    ON "cart_items" ("cartId")`);
        await queryRunner.query(`CREATE INDEX "IDX_cart_items_productId" ON "cart_items" ("productId")`);

        // ── 9. promotions ───────────────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "promotions_type_enum"          AS ENUM ('boost_account', 'get_sales', 'campaign')
        `);
        await queryRunner.query(`
            CREATE TYPE "promotions_duration_enum"      AS ENUM ('one_day', 'one_week', 'one_month', 'custom')
        `);
        await queryRunner.query(`
            CREATE TYPE "promotions_status_enum"        AS ENUM ('pending', 'active', 'completed', 'cancelled', 'failed')
        `);
        await queryRunner.query(`
            CREATE TYPE "promotions_paymentstatus_enum" AS ENUM ('pending', 'paid', 'failed')
        `);
        await queryRunner.query(`
            CREATE TABLE "promotions" (
                "id"                 uuid                           NOT NULL DEFAULT uuid_generate_v4(),
                "vendorId"           uuid                           NOT NULL,
                "type"               "promotions_type_enum"         NOT NULL,
                "subType"            character varying,
                "title"              character varying              NOT NULL,
                "duration"           "promotions_duration_enum"     NOT NULL,
                "customDays"         integer,
                "startDate"          TIMESTAMP,
                "endDate"            TIMESTAMP,
                "status"             "promotions_status_enum"       NOT NULL DEFAULT 'pending',
                "pricePaid"          numeric(12,2)                  NOT NULL,
                "paymentStatus"      "promotions_paymentstatus_enum" NOT NULL DEFAULT 'pending',
                "paymentReference"   character varying,
                "paymentAuthUrl"     character varying,
                "paymentProvider"    character varying,
                "termsAccepted"      boolean                        NOT NULL DEFAULT false,
                "createdAt"          TIMESTAMP                      NOT NULL DEFAULT now(),
                "updatedAt"          TIMESTAMP                      NOT NULL DEFAULT now(),
                CONSTRAINT "PK_promotions"        PRIMARY KEY ("id"),
                CONSTRAINT "FK_promotions_vendor" FOREIGN KEY ("vendorId") REFERENCES "vendor_profiles" ("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_promotions_vendorId"          ON "promotions" ("vendorId")`);
        await queryRunner.query(`CREATE INDEX "IDX_promotions_status"            ON "promotions" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_promotions_paymentReference"  ON "promotions" ("paymentReference")`);

        // ── 10. promotion_products ──────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TABLE "promotion_products" (
                "id"          uuid      NOT NULL DEFAULT uuid_generate_v4(),
                "promotionId" uuid      NOT NULL,
                "productId"   uuid      NOT NULL,
                "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_promotion_products"            PRIMARY KEY ("id"),
                CONSTRAINT "FK_promotion_products_promotion" FOREIGN KEY ("promotionId") REFERENCES "promotions" ("id") ON DELETE CASCADE,
                CONSTRAINT "FK_promotion_products_product"   FOREIGN KEY ("productId")   REFERENCES "products"   ("id") ON DELETE CASCADE
            )
        `);

        // ── 11. campaign_products ───────────────────────────────────────────────
        await queryRunner.query(`
            CREATE TYPE "campaign_products_category_enum" AS ENUM (
                'health_wellness', 'medical_supplies', 'baby_mother_care',
                'fitness_lifestyle', 'nutrition_healthy_living', 'others', 'medications'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "campaign_products" (
                "id"            uuid                               NOT NULL DEFAULT uuid_generate_v4(),
                "promotionId"   uuid                               NOT NULL,
                "title"         character varying                  NOT NULL,
                "category"      "campaign_products_category_enum"  NOT NULL,
                "description"   text                               NOT NULL,
                "price"         numeric(12,2)                      NOT NULL,
                "stockQuantity" integer                            NOT NULL DEFAULT 0,
                "mediaUrls"     json,
                "createdAt"     TIMESTAMP                          NOT NULL DEFAULT now(),
                "updatedAt"     TIMESTAMP                          NOT NULL DEFAULT now(),
                CONSTRAINT "PK_campaign_products"            PRIMARY KEY ("id"),
                CONSTRAINT "FK_campaign_products_promotion" FOREIGN KEY ("promotionId") REFERENCES "promotions" ("id") ON DELETE CASCADE
            )
        `);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "campaign_products"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "promotion_products"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "promotions"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "cart_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "carts"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "product_media"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "vendor_verification_requests"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "vendor_documents"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "vendor_profiles"`);

        await queryRunner.query(`DROP TYPE IF EXISTS "campaign_products_category_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "promotions_paymentstatus_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "promotions_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "promotions_duration_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "promotions_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "product_media_mediatype_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "products_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "products_subcategory_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "products_category_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_verification_requests_priority_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_verification_requests_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_verification_requests_requesttype_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_documents_verificationstatus_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_documents_documenttype_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_profiles_verificationstatus_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "vendor_profiles_businesscategory_enum"`);
        // Note: PostgreSQL does not support removing values from enum types.
        // The vendor/pending_vendor_verification values added to users enums remain.
    }
}
