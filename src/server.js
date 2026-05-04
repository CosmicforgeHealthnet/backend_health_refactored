require('dotenv').config();
const { app, httpServer } = require("./app");
const AppDataSource = require("./config/database");
const redisClient = require("./config/redisClient");
// In your app.js or server.js
const config = require("./config");
const RunJobs = require('./jobs');

// Start referral draw job
let redisConnected = false;

async function connectRedis() {
  try {
    await redisClient.connect();
    redisConnected = true;
    console.log("🟢 Redis connected");
    return true;
  } catch (error) {
    console.warn(
      "⚠️  Redis connection failed, continuing without Redis:",
      error.message
    );
    redisConnected = false;
    return false;
  }
}

async function startServer() {
  try {

    console.log("config.runMigrations", config.runMigrations);

    const shouldRunMigrations = config.runMigrations;

    // Initialize database
    await AppDataSource.initialize();
    console.log("✔️  Database connected");

    // Try to connect to Redis (non-blocking)
    // await connectRedis();

    if (shouldRunMigrations) {
      try {
        await AppDataSource.runMigrations();
        console.log("✔️  Migrations run successfully");
      } catch (err) {
        console.error("❌ Migration error:", err);
        throw err;
      }
    } else {
      console.log("Migrations skipped. Set RUN_MIGRATIONS=true to run them explicitly.");
    }

    //runing jobs```
    await RunJobs();

    // Start server
    httpServer.listen(config.port, () => {
      console.log(`🚀  Server running on http://localhost:${config.port}`);
      console.log(`📚  Swagger UI at http://localhost:${config.port}/api-docs`);
      //http://localhost:3000/pharmacy/api-docs
      console.log(`📚  Swagger UI pharmacy running at http://localhost:${config.port}/pharmacy-docs`);
      console.log(`🔌  WebSocket server ready for connections`);
      console.log(
        `🌐  WebSocket URL: ws://localhost:${config.port}/socket.io/`
      );

      if (!redisConnected) {
        console.log("⚠️  Running without Redis - some features may be limited");
      }
      console.log("⚠️  Running without Redis - some features may be limited");
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      console.log(`🛑 ${signal} received, shutting down gracefully...`);

      httpServer.close(async () => {
        try {
          if (redisConnected && redisClient.isOpen) {
            await redisClient.quit();
            console.log("✅ Redis disconnected");
          }
        } catch (error) {
          console.warn("⚠️  Redis disconnect error:", error.message);
        }

        try {
          await AppDataSource.destroy();
          console.log("✅ Database disconnected");
        } catch (error) {
          console.warn("⚠️  Database disconnect error:", error.message);
        }

        console.log("✅ Server shutdown complete");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (err) {
    console.error("❌ Startup error:", err);
    process.exit(1);
  }
}

//Optional: Redis reconnection logic
if (redisClient) {
  redisClient.on("error", (err) => {
    console.error("Redis error:", err);
    redisConnected = false;
  });

  redisClient.on("connect", () => {
    console.log("🟢 Redis reconnected");
    redisConnected = true;
  });

  redisClient.on("disconnect", () => {
    console.log("🔴 Redis disconnected");
    redisConnected = false;
  });
}

// Start the server
startServer();
