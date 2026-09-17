module.exports = class CreateAppFeedback1900000000060 {
    name = "CreateAppFeedback1900000000060";

    async up(queryRunner) {
        await queryRunner.query(`
            CREATE TABLE "app_feedback" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "authorId" uuid NOT NULL,
                "role" varchar(20) NOT NULL CHECK ("role" IN ('patient', 'doctor')),
                "experience" varchar(30) NOT NULL CHECK ("experience" IN ('smooth', 'some_difficulties', 'could_not_finish')),
                "troubleAreas" jsonb NOT NULL DEFAULT '[]'::jsonb,
                "comment" text CHECK (length("comment") <= 2000),
                "createdAt" timestamp NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query('CREATE INDEX "IDX_APP_FEEDBACK_AUTHOR" ON "app_feedback" ("authorId")');
    }

    async down(queryRunner) {
        await queryRunner.query('DROP TABLE "app_feedback"');
    }
};
