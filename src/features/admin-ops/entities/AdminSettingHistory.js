const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'AdminSettingHistory',
    tableName: 'admin_settings_history',
    columns: {
        id:        { type: 'uuid',      primary: true, generated: 'uuid' },
        settingId: { type: 'uuid' },
        category:  { type: 'varchar',   length: 100 },
        key:       { type: 'varchar',   length: 200 },
        oldValue:  { type: 'json',      nullable: true },
        newValue:  { type: 'json' },
        changedBy: { type: 'uuid' },
        changedAt: { type: 'timestamp', precision: 6, default: () => 'CURRENT_TIMESTAMP' },
    },
    indices: [
        { columns: ['settingId'] },
        { columns: ['category', 'key'] },
        { columns: ['changedBy'] },
        { columns: ['changedAt'] },
    ],
    relations: {
        setting: {
            type: 'many-to-one',
            target: 'AdminSetting',
            joinColumn: { name: 'settingId' },
            onDelete: 'CASCADE',
            inverseSide: 'history',
        },
        changedByUser: {
            type: 'many-to-one',
            target: 'User',
            joinColumn: { name: 'changedBy' },
            onUpdate: 'NO ACTION',
        },
    },
});
