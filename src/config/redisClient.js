// redisClient.js
require("dotenv").config();
const redis = require("redis");

let redisOptions = {};

const env = process.env.NODE_ENV || "development";

if (env === "development") {
  redisOptions = {
    socket: {
      host: process.env.REDIS_DEV_HOST || "localhost",
      port: process.env.REDIS_DEV_PORT || 6379,
      connectTimeout: 5000,
      lazyConnect: true, // Don't connect immediately
    },
  };
} else if (env === "testing") {
  redisOptions = {
    socket: {
      host: process.env.REDIS_TEST_HOST || "localhost",
      port: process.env.REDIS_TEST_PORT || 6379,
      connectTimeout: 5000,
      lazyConnect: true,
    },
  };
} else if (env === "production") {
  // For Render, you might get REDIS_URL instead of separate host/port/password
  if (process.env.REDIS_URL) {
    redisOptions = {
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 10000,
        lazyConnect: true,
      },
    };
  } else {
    redisOptions = {
      socket: {
        host: process.env.REDIS_PROD_HOST,
        port: process.env.REDIS_PROD_PORT || 6379,
        connectTimeout: 10000,
        lazyConnect: true,
      },
      password: process.env.REDIS_PROD_PASSWORD,
    };
  }
} else {
  console.warn("NODE_ENV not set properly, defaulting to development");
  redisOptions = {
    socket: {
      host: "localhost",
      port: 6379,
      connectTimeout: 5000,
      lazyConnect: true,
    },
  };
}

let client;

try {
  // Create Redis client
  client = redis.createClient(redisOptions);

  // Handle connection events
  client.on("error", (err) => {
    console.error(`Redis (${env}) error:`, err);
  });

  client.on("connect", () => {
    console.log(`🟢 Connected to Redis (${env})`);
  });

  client.on("ready", () => {
    console.log(`✅ Redis (${env}) ready for commands`);
  });

  client.on("end", () => {
    console.log(`🔴 Redis (${env}) connection ended`);
  });

  client.on("reconnecting", () => {
    console.log(`🔄 Reconnecting to Redis (${env})...`);
  });

} catch (error) {
  console.warn(`Failed to create Redis client for ${env}:`, error);
  
  // Create a mock client for graceful degradation
  client = {
    connect: () => {
      console.warn("Redis not available, using mock client");
      return Promise.reject(new Error('Redis not available'));
    },
    isOpen: false,
    isReady: false,
    quit: () => Promise.resolve(),
    disconnect: () => Promise.resolve(),
    
    // Mock Redis methods that your app might use
    get: (key) => {
      console.warn(`Redis GET ${key} - using mock (returns null)`);
      return Promise.resolve(null);
    },
    set: (key, value, options) => {
      console.warn(`Redis SET ${key} - using mock`);
      return Promise.resolve('OK');
    },
    del: (key) => {
      console.warn(`Redis DEL ${key} - using mock`);
      return Promise.resolve(0);
    },
    exists: (key) => {
      console.warn(`Redis EXISTS ${key} - using mock`);
      return Promise.resolve(0);
    },
    expire: (key, seconds) => {
      console.warn(`Redis EXPIRE ${key} ${seconds} - using mock`);
      return Promise.resolve(1);
    },
    hGet: (hash, field) => {
      console.warn(`Redis HGET ${hash} ${field} - using mock`);
      return Promise.resolve(null);
    },
    hSet: (hash, field, value) => {
      console.warn(`Redis HSET ${hash} ${field} - using mock`);
      return Promise.resolve(1);
    },
    hDel: (hash, field) => {
      console.warn(`Redis HDEL ${hash} ${field} - using mock`);
      return Promise.resolve(0);
    },
    
    // Add more methods as needed based on your app's usage
    on: () => {}, // No-op event listener
    off: () => {}, // No-op event listener
  };
}

// Export client
module.exports = client;