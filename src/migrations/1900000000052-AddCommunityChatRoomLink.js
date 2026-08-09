/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddCommunityChatRoomLink1900000000052 {
    name = 'AddCommunityChatRoomLink1900000000052'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "communities" ADD COLUMN "chatRoomId" uuid`);
        await queryRunner.query(`
            ALTER TABLE "communities"
            ADD CONSTRAINT "FK_communities_chatRoom" FOREIGN KEY ("chatRoomId") REFERENCES "chat_rooms" ("id") ON DELETE SET NULL
        `);
        await queryRunner.query(`CREATE INDEX "IDX_COMMUNITY_CHAT_ROOM" ON "communities" ("chatRoomId")`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_COMMUNITY_CHAT_ROOM"`);
        await queryRunner.query(`ALTER TABLE "communities" DROP CONSTRAINT IF EXISTS "FK_communities_chatRoom"`);
        await queryRunner.query(`ALTER TABLE "communities" DROP COLUMN IF EXISTS "chatRoomId"`);
    }
}
