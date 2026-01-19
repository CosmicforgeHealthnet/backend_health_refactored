const redisClient = require('../../config/redisClient');

// Cache middleware with TTL (time-to-live)
const cache = {
    get: async (key) => {
        try {
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error("Cache get error:", error);
            return null;
        }
    },

    set: async (key, value, ttl = 3600) => {
        try {
            await client.set(key, JSON.stringify(value), "EX", ttl);
        } catch (error) {
            console.error("Cache set error:", error);
        }
    },

    del: async (key) => {
        try {
            await client.del(key);
        } catch (error) {
            console.error("Cache delete error:", error);
        }
    },

    flush: async () => {
        try {
            await client.flushdb();
        } catch (error) {
            console.error("Cache flush error:", error);
        }
    },
};

module.exports = cache;
