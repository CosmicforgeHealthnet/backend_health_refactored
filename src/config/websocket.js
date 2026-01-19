let io;

module.exports = {
  initWebSocket(httpServer) {
    const Server = require("socket.io").Server;
    const config = require("./index");

    console.log("🚀 Initializing Socket.IO WebSocket server...");

    io = new Server(httpServer, {
      cors: {
        origin: config.corsOrigins,
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e6, // 1MB
      allowEIO3: true,
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true
      },
    });

    // Log server initialization
    console.log("✅ Socket.IO server configured with:");
    console.log(`   CORS Origins: ${config.corsOrigins.join(", ")}`);
    console.log(`   Transports: websocket, polling`);
    console.log(`   Ping Timeout: 60s`);
    console.log(`   Ping Interval: 25s`);
    console.log(`   Connection Recovery: 2 minutes`);

    // Add server-level event logging
    io.engine.on("initial_headers", (headers, request) => {
      console.log(`🔗 Initial headers for ${request.url}`);
    });

    io.engine.on("headers", (headers, request) => {
      headers["X-Powered-By"] = "CosmicForge-Health-Socket.IO";
    });

    io.engine.on("connection_error", (err) => {
      console.log(`🚫 Socket.IO connection error:`, {
        message: err.message,
        description: err.description,
        context: err.context,
        type: err.type
      });
    });

    console.log("🎯 Socket.IO WebSocket server initialized successfully");
    return io;
  },

  getIO() {
    if (!io) {
      throw new Error("Socket.io not initialized! Call initWebSocket() first.");
    }
    return io;
  },
};