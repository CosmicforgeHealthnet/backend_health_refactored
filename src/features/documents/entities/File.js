// src/entities/File.js
const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'File',
  tableName: 'files',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid'
    },
    uploadBy: {
      name: 'upload_by',
      type: 'uuid',
      nullable: false
    },
    fileUrl: {
      name: 'file_url',
      type: 'varchar',
      length: 1024,
      nullable: false
    },
    fileName: {
      name: 'file_name',
      type: 'varchar',
      length: 255,
      nullable: false
    },
    folderName: {
      name: 'folder_name',
      type: 'varchar',
      length: 255,
      nullable: false
    },
    fileId: {
      name: 'file_id',
      type: 'varchar',
      length: 255,
      nullable: false,
      comment: 'Cloud provider file identifier'
    },
    createdAt: {
      name: 'created_at',
      type: 'timestamp',
      createDate: true
    }
  },
  relations: {
    uploader: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: {
        name: 'upload_by',
        referencedColumnName: 'id'
      },
      nullable: false,
      onDelete: 'CASCADE'
    }
  }
});