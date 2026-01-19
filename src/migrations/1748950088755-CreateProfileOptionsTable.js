const { Table, TableIndex } = require('typeorm');

module.exports = class CreateProfileOptionsTable1749286260000 {
  async up(queryRunner) {
    await queryRunner.createTable(
      new Table({
        name: 'profile_options',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'profileType',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'field',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'value',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'profile_options',
      new TableIndex({
        name: 'IDX_profile_option_type_field_value',
        columnNames: ['profileType', 'field', 'value'],
        isUnique: true,
      })
    );
  }

  async down(queryRunner) {
    await queryRunner.dropIndex('profile_options', 'IDX_profile_option_type_field_value');
    await queryRunner.dropTable('profile_options');
  }
};