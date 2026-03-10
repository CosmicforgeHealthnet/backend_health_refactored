/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class CreateSubscriptionsTable1749259388341 {
    name = 'CreateSubscriptionsTable1749259388341'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tier" "public"."subscriptions_tier_enum" NOT NULL, "status" "public"."subscriptions_status_enum" NOT NULL DEFAULT 'active', "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP NOT NULL, "nextBillingDate" TIMESTAMP, "autoRenew" boolean NOT NULL DEFAULT false, "price" double precision NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_fbdba4e2ac694cf8c9cecf4dc84" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_fbdba4e2ac694cf8c9cecf4dc84"`);
        await queryRunner.query(`DROP TABLE "subscriptions"`);
    }
}
