/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class PaymentANDwalletSystem1750519428619 {
    name = 'PaymentANDwalletSystem1750519428619'

    async up(queryRunner) {
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactions_servicetype_enum') THEN CREATE TYPE "public"."transactions_servicetype_enum" AS ENUM('appointment', 'subscription', 'lab_test', 'pharmacy', 'document_access', 'verification_fee', 'chat_premium', 'other'); END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactions_plantype_enum') THEN CREATE TYPE "public"."transactions_plantype_enum" AS ENUM('free', 'basic', 'medium', 'premium', 'one_time'); END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactions_billingcycle_enum') THEN CREATE TYPE "public"."transactions_billingcycle_enum" AS ENUM('one_time', 'monthly', 'quarterly', 'yearly'); END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactions_paymentprovider_enum') THEN CREATE TYPE "public"."transactions_paymentprovider_enum" AS ENUM('flutterwave', 'paystack'); END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactions_status_enum') THEN CREATE TYPE "public"."transactions_status_enum" AS ENUM('pending', 'processing', 'completed', 'failed', 'disputed', 'refunded', 'cancelled'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "patientId" uuid NOT NULL, "doctorId" uuid NOT NULL, "appointmentId" uuid, "paymentMethodId" uuid, "serviceType" "public"."transactions_servicetype_enum" NOT NULL, "serviceId" uuid, "planType" "public"."transactions_plantype_enum", "billingCycle" "public"."transactions_billingcycle_enum" NOT NULL DEFAULT 'one_time', "servicePeriodStart" TIMESTAMP, "servicePeriodEnd" TIMESTAMP, "originalAmount" numeric(10,2) NOT NULL, "originalCurrency" character varying(3) NOT NULL, "usdAmount" numeric(10,2) NOT NULL, "exchangeRateUsed" numeric(10,6) NOT NULL, "paymentProvider" "public"."transactions_paymentprovider_enum" NOT NULL, "providerTransactionId" character varying, "providerReference" character varying, "providerFee" numeric(10,2), "description" character varying, "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'pending', "disputeWindowEndsAt" TIMESTAMP, "disputeRaisedAt" TIMESTAMP, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "completedAt" TIMESTAMP, "failedAt" TIMESTAMP, CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id")); COMMENT ON COLUMN "transactions"."serviceId" IS 'ID of the service being paid for (appointment_id, subscription_id, etc.)'; COMMENT ON COLUMN "transactions"."originalAmount" IS 'Amount in original currency patient paid'; COMMENT ON COLUMN "transactions"."originalCurrency" IS 'ISO currency code (NGN, GHS, USD, etc.)'; COMMENT ON COLUMN "transactions"."usdAmount" IS 'Amount converted to USD (base currency)'; COMMENT ON COLUMN "transactions"."exchangeRateUsed" IS 'Exchange rate at time of conversion'; COMMENT ON COLUMN "transactions"."providerTransactionId" IS 'Transaction ID from Flutterwave/Paystack'; COMMENT ON COLUMN "transactions"."providerReference" IS 'Provider''s reference number'; COMMENT ON COLUMN "transactions"."providerFee" IS 'Fee charged by payment provider'; COMMENT ON COLUMN "transactions"."disputeWindowEndsAt" IS 'When 3-day dispute window ends'; COMMENT ON COLUMN "transactions"."metadata" IS 'Additional payment data from provider'`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_83d7b5bff889a7117576041154" ON "transactions" ("patientId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_0616e035d18de9188812a5de38" ON "transactions" ("doctorId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_44451197b235962f0e5658660b" ON "transactions" ("paymentProvider") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_da87c55b3bbbe96c6ed88ea7ee" ON "transactions" ("status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_eb87291e3c049754429850add9" ON "transactions" ("serviceType") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_0b3d73b95be17139f98c9d8091" ON "transactions" ("planType") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_e744417ceb0b530285c08f3865" ON "transactions" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_91e31a934485712dd3e06c135b" ON "transactions" ("providerTransactionId") `);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_splits_type_enum') THEN CREATE TYPE "public"."transaction_splits_type_enum" AS ENUM('appointment_fee', 'service_fee', 'vat'); END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_splits_recipienttype_enum') THEN CREATE TYPE "public"."transaction_splits_recipienttype_enum" AS ENUM('doctor_wallet', 'company_wallet'); END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_splits_status_enum') THEN CREATE TYPE "public"."transaction_splits_status_enum" AS ENUM('pending', 'released', 'refunded', 'held'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "transaction_splits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "transactionId" uuid NOT NULL, "type" "public"."transaction_splits_type_enum" NOT NULL, "originalAmount" numeric(10,2) NOT NULL, "originalCurrency" character varying(3) NOT NULL, "usdAmount" numeric(10,2) NOT NULL, "recipientType" "public"."transaction_splits_recipienttype_enum" NOT NULL, "recipientId" uuid, "status" "public"."transaction_splits_status_enum" NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "releasedAt" TIMESTAMP, "refundedAt" TIMESTAMP, CONSTRAINT "PK_ff450f3d91d3c2764e27a3dfc15" PRIMARY KEY ("id")); COMMENT ON COLUMN "transaction_splits"."recipientId" IS 'Doctor ID for doctor_wallet, null for company_wallet'`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_e26abb9a10ed9c148afe8c6e42" ON "transaction_splits" ("transactionId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_a9e4ceab38f8b8e03b0a5da508" ON "transaction_splits" ("type") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fa1c529ac27b6cad1d38252717" ON "transaction_splits" ("recipientType") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_7448510c7bc2093388492bdab8" ON "transaction_splits" ("status") `);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_payment_methods_lastsuccessfulprovider_enum') THEN CREATE TYPE "public"."user_payment_methods_lastsuccessfulprovider_enum" AS ENUM('flutterwave', 'paystack'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "user_payment_methods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "cardLast4" character varying(4) NOT NULL, "cardType" character varying, "cardBrand" character varying, "bankName" character varying, "flutterwaveToken" character varying, "paystackToken" character varying, "flutterwaveSuccessCount" integer NOT NULL DEFAULT '0', "flutterwaveAttemptCount" integer NOT NULL DEFAULT '0', "paystackSuccessCount" integer NOT NULL DEFAULT '0', "paystackAttemptCount" integer NOT NULL DEFAULT '0', "lastSuccessfulProvider" "public"."user_payment_methods_lastsuccessfulprovider_enum", "isDefault" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "lastUsedAt" TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3baaffbd29bfd03e2c9e9a1fd24" PRIMARY KEY ("id")); COMMENT ON COLUMN "user_payment_methods"."cardType" IS 'Visa, Mastercard, etc.'`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_de52ee40aabfbe3eef30992bf6" ON "user_payment_methods" ("userId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_c77950cb2790919afb7fefac02" ON "user_payment_methods" ("cardLast4") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_36fc681071ff45f468667d7eef" ON "user_payment_methods" ("lastSuccessfulProvider") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3fc9018c9d01465607154c7145" ON "user_payment_methods" ("isDefault") `);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "doctor_wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "doctorId" uuid NOT NULL, "totalBalanceUsd" numeric(12,2) NOT NULL DEFAULT '0', "pendingCreditsUsd" numeric(12,2) NOT NULL DEFAULT '0', "availableBalanceUsd" numeric(12,2) NOT NULL DEFAULT '0', "preferredDisplayCurrency" character varying(3) NOT NULL DEFAULT 'USD', "minimumWithdrawal" numeric(10,2) NOT NULL DEFAULT '10', "bankDetails" jsonb, "isActive" boolean NOT NULL DEFAULT true, "isFrozen" boolean NOT NULL DEFAULT false, "frozenReason" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastWithdrawalAt" TIMESTAMP, CONSTRAINT "UQ_90572fa4bc9c93545fcdbd8d157" UNIQUE ("doctorId"), CONSTRAINT "REL_90572fa4bc9c93545fcdbd8d15" UNIQUE ("doctorId"), CONSTRAINT "PK_4c9d64a0dd27e0a946f011fb26f" PRIMARY KEY ("id")); COMMENT ON COLUMN "doctor_wallets"."totalBalanceUsd" IS 'Total earnings in USD'; COMMENT ON COLUMN "doctor_wallets"."pendingCreditsUsd" IS 'Funds in 3-day dispute window'; COMMENT ON COLUMN "doctor_wallets"."availableBalanceUsd" IS 'Withdrawable funds'; COMMENT ON COLUMN "doctor_wallets"."preferredDisplayCurrency" IS 'Currency for wallet display (NGN, GHS, USD, etc.)'; COMMENT ON COLUMN "doctor_wallets"."minimumWithdrawal" IS 'Minimum withdrawal amount in USD'; COMMENT ON COLUMN "doctor_wallets"."bankDetails" IS 'Encrypted bank account details for withdrawals'`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_90572fa4bc9c93545fcdbd8d15" ON "doctor_wallets" ("doctorId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dd8bf9ccc12bf22c5830838578" ON "doctor_wallets" ("isActive") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_6b8abe1b7c3f3aa5d349bf7914" ON "doctor_wallets" ("isFrozen") `);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disputes_type_enum') THEN CREATE TYPE "public"."disputes_type_enum" AS ENUM('refund_request', 'chargeback', 'quality_complaint'); END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disputes_status_enum') THEN CREATE TYPE "public"."disputes_status_enum" AS ENUM('pending', 'approved', 'rejected', 'escalated', 'resolved'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "disputes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "transactionId" uuid NOT NULL, "patientId" uuid NOT NULL, "doctorId" uuid NOT NULL, "type" "public"."disputes_type_enum" NOT NULL DEFAULT 'refund_request', "status" "public"."disputes_status_enum" NOT NULL DEFAULT 'pending', "reason" text NOT NULL, "patientDescription" text, "doctorResponse" text, "adminNotes" text, "refundAmount" numeric(10,2), "refundCurrency" character varying(3), "attachments" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "respondedAt" TIMESTAMP, "resolvedAt" TIMESTAMP, "escalatedAt" TIMESTAMP, CONSTRAINT "PK_3c97580d01c1a4b0b345c42a107" PRIMARY KEY ("id")); COMMENT ON COLUMN "disputes"."attachments" IS 'File attachments for dispute evidence'`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_9661150a3f25a5c44c891af56f" ON "disputes" ("transactionId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_0ea46f4f2225f38d127063c367" ON "disputes" ("status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_3c58ed268aafa4d1148077b855" ON "disputes" ("type") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_af1b242c5899aad926113d1fbd" ON "disputes" ("createdAt") `);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_withdrawals_status_enum') THEN CREATE TYPE "public"."wallet_withdrawals_status_enum" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled'); END IF; END $$;`);
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "wallet_withdrawals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "walletId" uuid NOT NULL, "doctorId" uuid NOT NULL, "amountUsd" numeric(10,2) NOT NULL, "requestedCurrency" character varying(3) NOT NULL, "requestedAmount" numeric(10,2) NOT NULL, "exchangeRateUsed" numeric(10,6), "bankDetails" jsonb NOT NULL, "status" "public"."wallet_withdrawals_status_enum" NOT NULL DEFAULT 'pending', "providerReference" character varying, "failureReason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "processedAt" TIMESTAMP, "completedAt" TIMESTAMP, CONSTRAINT "PK_8683ec82b0640730c9453d6b859" PRIMARY KEY ("id")); COMMENT ON COLUMN "wallet_withdrawals"."bankDetails" IS 'Bank account details for this withdrawal'`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ad29fd88b669636c93be627401" ON "wallet_withdrawals" ("walletId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_681130ff2c4853d604c2e08120" ON "wallet_withdrawals" ("doctorId") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_dac744fc4dd94d79755e42a561" ON "wallet_withdrawals" ("status") `);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_8830c122a4c67a23e49b66a2dd" ON "wallet_withdrawals" ("createdAt") `);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_83d7b5bff889a7117576041154f') THEN ALTER TABLE "transactions" ADD CONSTRAINT "FK_83d7b5bff889a7117576041154f" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_0616e035d18de9188812a5de386') THEN ALTER TABLE "transactions" ADD CONSTRAINT "FK_0616e035d18de9188812a5de386" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_50db78fa73cb72af407852b6db9') THEN ALTER TABLE "transactions" ADD CONSTRAINT "FK_50db78fa73cb72af407852b6db9" FOREIGN KEY ("paymentMethodId") REFERENCES "user_payment_methods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_e26abb9a10ed9c148afe8c6e427') THEN ALTER TABLE "transaction_splits" ADD CONSTRAINT "FK_e26abb9a10ed9c148afe8c6e427" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_de52ee40aabfbe3eef30992bf65') THEN ALTER TABLE "user_payment_methods" ADD CONSTRAINT "FK_de52ee40aabfbe3eef30992bf65" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_90572fa4bc9c93545fcdbd8d157') THEN ALTER TABLE "doctor_wallets" ADD CONSTRAINT "FK_90572fa4bc9c93545fcdbd8d157" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_9661150a3f25a5c44c891af56fe') THEN ALTER TABLE "disputes" ADD CONSTRAINT "FK_9661150a3f25a5c44c891af56fe" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ceeb1b0a31daf4b221a8168226f') THEN ALTER TABLE "disputes" ADD CONSTRAINT "FK_ceeb1b0a31daf4b221a8168226f" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_1ca485b53d9b1d27df67771cfdc') THEN ALTER TABLE "disputes" ADD CONSTRAINT "FK_1ca485b53d9b1d27df67771cfdc" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ad29fd88b669636c93be6274019') THEN ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "FK_ad29fd88b669636c93be6274019" FOREIGN KEY ("walletId") REFERENCES "doctor_wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
        await queryRunner.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_681130ff2c4853d604c2e081207') THEN ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "FK_681130ff2c4853d604c2e081207" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$;`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP CONSTRAINT "FK_681130ff2c4853d604c2e081207"`);
        await queryRunner.query(`ALTER TABLE "wallet_withdrawals" DROP CONSTRAINT "FK_ad29fd88b669636c93be6274019"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT "FK_1ca485b53d9b1d27df67771cfdc"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT "FK_ceeb1b0a31daf4b221a8168226f"`);
        await queryRunner.query(`ALTER TABLE "disputes" DROP CONSTRAINT "FK_9661150a3f25a5c44c891af56fe"`);
        await queryRunner.query(`ALTER TABLE "doctor_wallets" DROP CONSTRAINT "FK_90572fa4bc9c93545fcdbd8d157"`);
        await queryRunner.query(`ALTER TABLE "user_payment_methods" DROP CONSTRAINT "FK_de52ee40aabfbe3eef30992bf65"`);
        await queryRunner.query(`ALTER TABLE "transaction_splits" DROP CONSTRAINT "FK_e26abb9a10ed9c148afe8c6e427"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_50db78fa73cb72af407852b6db9"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_0616e035d18de9188812a5de386"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_83d7b5bff889a7117576041154f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8830c122a4c67a23e49b66a2dd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dac744fc4dd94d79755e42a561"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_681130ff2c4853d604c2e08120"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ad29fd88b669636c93be627401"`);
        await queryRunner.query(`DROP TABLE "wallet_withdrawals"`);
        await queryRunner.query(`DROP TYPE "public"."wallet_withdrawals_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_af1b242c5899aad926113d1fbd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3c58ed268aafa4d1148077b855"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ea46f4f2225f38d127063c367"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9661150a3f25a5c44c891af56f"`);
        await queryRunner.query(`DROP TABLE "disputes"`);
        await queryRunner.query(`DROP TYPE "public"."disputes_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."disputes_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b8abe1b7c3f3aa5d349bf7914"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dd8bf9ccc12bf22c5830838578"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_90572fa4bc9c93545fcdbd8d15"`);
        await queryRunner.query(`DROP TABLE "doctor_wallets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3fc9018c9d01465607154c7145"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_36fc681071ff45f468667d7eef"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c77950cb2790919afb7fefac02"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_de52ee40aabfbe3eef30992bf6"`);
        await queryRunner.query(`DROP TABLE "user_payment_methods"`);
        await queryRunner.query(`DROP TYPE "public"."user_payment_methods_lastsuccessfulprovider_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7448510c7bc2093388492bdab8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fa1c529ac27b6cad1d38252717"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a9e4ceab38f8b8e03b0a5da508"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e26abb9a10ed9c148afe8c6e42"`);
        await queryRunner.query(`DROP TABLE "transaction_splits"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_splits_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_splits_recipienttype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_splits_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_91e31a934485712dd3e06c135b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e744417ceb0b530285c08f3865"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0b3d73b95be17139f98c9d8091"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eb87291e3c049754429850add9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da87c55b3bbbe96c6ed88ea7ee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_44451197b235962f0e5658660b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0616e035d18de9188812a5de38"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_83d7b5bff889a7117576041154"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_paymentprovider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_billingcycle_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_plantype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_servicetype_enum"`);
    }
}
