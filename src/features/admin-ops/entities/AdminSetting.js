const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'AdminSetting',
    tableName: 'admin_settings',
    columns: {
        id:        { type: 'uuid',       primary: true, generated: 'uuid' },
        category:  { type: 'varchar',    length: 100 },
        key:       { type: 'varchar',    length: 200 },
        value:     { type: 'json' },
        updatedBy: { type: 'uuid',       nullable: true },
        createdAt: { type: 'timestamp',  precision: 6, default: () => 'CURRENT_TIMESTAMP' },
        updatedAt: { type: 'timestamp',  precision: 6, default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
    },
    uniques: [{ columns: ['category', 'key'] }],
    indices: [
        { columns: ['category'] },
        { columns: ['updatedBy'] },
    ],
    relations: {
        updatedByUser: {
            type: 'many-to-one',
            target: 'User',
            joinColumn: { name: 'updatedBy' },
            nullable: true,
            onUpdate: 'NO ACTION',
            onDelete: 'SET NULL',
        },
        history: {
            type: 'one-to-many',
            target: 'AdminSettingHistory',
            inverseSide: 'setting',
        },
    },
});
