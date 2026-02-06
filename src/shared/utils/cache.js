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
            await redisClient.set(key, JSON.stringify(value), { EX: ttl });
        } catch (error) {
            console.error("Cache set error:", error);
        }
    },

    del: async (key) => {
        try {
            await redisClient.del(key);
        } catch (error) {
            console.error("Cache delete error:", error);
        }
    },

    flush: async () => {
        try {
            await redisClient.flushDb();
        } catch (error) {
            console.error("Cache flush error:", error);
        }
    },

    /**
     * Helper to get data from cache or fetch from source if missing.
     * Gracefully handles Redis failures by executing the fetch function.
     * @param {string} key - Cache key
     * @param {Function} fetchFn - Function to fetch data if cache miss
     * @param {number} ttl - Time to live in seconds
     */
    getOrSet: async (key, fetchFn, ttl = 3600) => {
        try {
            // 1. Try to get from cache
            const cachedData = await redisClient.get(key);
            if (cachedData) {
                return JSON.parse(cachedData);
            }
        } catch (error) {
            // Log error but continue to fetch fresh data
            console.warn(`Cache skip for key ${key}:`, error.message);
        }

        // 2. Fetch fresh data (either cache miss or redis error)
        const data = await fetchFn();

        // 3. Store in cache (fire and forget)
        if (data) {
            try {
                await redisClient.set(key, JSON.stringify(data), { EX: ttl });
            } catch (error) {
                console.error(`Failed to cache key ${key}:`, error.message);
            }
        }

        return data;
    },

    /**
     * Invalidate all keys matching a pattern
     * @param {string} pattern - Key pattern (e.g. 'doctor:*')
     */
    invalidatePattern: async (pattern) => {
        try {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } catch (error) {
            console.error(`Failed to invalidate pattern ${pattern}:`, error.message);
        }
    }
};

module.exports = cache;
