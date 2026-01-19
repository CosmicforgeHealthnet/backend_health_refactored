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
        },
        field: {
            type: 'varchar',
        },
        value: {
            type: 'varchar',
        },
        createdAt: {
            type: 'timestamp',
            createDate: true,
        },
    },
});
