const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
    name: 'ProfileOption',
    tableName: 'profile_options',
    columns: {
        id: {
            primary: true,
            type: 'uuid',
            generated: 'uuid',
        },
        profileType: {
            type: 'varchar', // 'patient' or 'doctor'
            nullable: true,
        },
        field: {
            type: 'varchar',
            nullable: true,
        },
        value: {
            type: 'varchar',
            nullable: true,
        },
        createdAt: {
            type: 'timestamp',
            createDate: true,
        },
    },
});
