// /**
//  * @typedef {import('typeorm').MigrationInterface} MigrationInterface
//  */

// /**
//  * @class
//  * @implements {MigrationInterface}
//  */
// module.exports = class CreateBoolonPhamacy1755875355759 {
//     name = 'CreateBoolonPhamacy1755875355759'

//     async up(queryRunner) {
//         await queryRunner.query(`ALTER TABLE "pharmacy_profiles" ADD "documentsSubmitted" boolean NOT NULL DEFAULT false`);
//     }

//     async down(queryRunner) {
//         await queryRunner.query(`ALTER TABLE "pharmacy_profiles" DROP COLUMN "documentsSubmitted"`);
//     }
// }
