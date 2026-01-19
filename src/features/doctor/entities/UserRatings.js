// user-rating.entity.js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'UserRating',
  tableName: 'user_ratings',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid',
    },
    rating: {
      type: 'decimal',
      precision: 2,
      scale: 1,
    },
    message: {
      type: 'text',
      nullable: true,
    },
    createdAt: {
      type: 'timestamp',
      createDate: true,
    },
  },
  relations: {
    user: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: true,
      onDelete: 'CASCADE',
    },
  },
});
