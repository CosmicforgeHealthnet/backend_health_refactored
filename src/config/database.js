// src/config/database.js
require("reflect-metadata");
const { DataSource } = require("typeorm");
const config = require("./index"); // this must be your index.js
const entities = require("../entities/index");

const AppDataSource = new DataSource({
  type: "postgres",
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  // synchronize: process.env.NODE_ENV === 'development',
  synchronize: true,
  logging: false,
  entities,
  migrations: [
    "src/migrations/*.js",
    "src/migrations/chat/*.js"
  ],
});

module.exports = AppDataSource;