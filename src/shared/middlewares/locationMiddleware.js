// src/middlewares/locationMiddleware.js
const axios = require('axios');

/**
 * Location middleware to get user location from IP address
 * Adds location to request object and response headers
 */
const getLocationFromIP = async (req, res, next) => {
  try {
    // 🔧 Get real IP address (handles proxies, load balancers)
    const ip = getClientIP(req);
    
    // 🔧 Skip for localhost/development
    if (isLocalIP(ip)) {
      req.location = {
        country: 'Nigeria', // Default for development
        city: 'Lagos',
        regionName: 'Lagos',
        timezone: 'Africa/Lagos',
        ip: ip
      };
      
      setLocationHeaders(res, req.location);
      return next();
    }
    
    // console.log(`🌍 Fetching location for IP: ${ip}`);
    
    // 🔧 Call IP geolocation API with timeout
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 3000, // 3 second timeout
      params: {
        fields: 'status,message,country,countryCode,region,regionName,city,timezone,query'
      }
    });
    
    // 🔧 Check if API call was successful
    if (response.data.status === 'success') {
      req.location = {
        country: response.data.country || 'Unknown',
        countryCode: response.data.countryCode || 'Unknown',
        city: response.data.city || 'Unknown',
        region: response.data.region || 'Unknown',
        regionName: response.data.regionName || 'Unknown',
        timezone: response.data.timezone || 'Unknown',
        ip: ip
      };
      
      // console.log(`✅ Location found: ${req.location.city}, ${req.location.country}`);
    } else {
      throw new Error(response.data.message || 'API returned error');
    }
    
    // 🔥 ADD TO RESPONSE HEADERS
    setLocationHeaders(res, req.location);
    
    next();
    
  } catch (error) {
    console.warn('⚠️ Location detection failed:', error.message);
    
    // 🔧 Fallback location data
    req.location = { 
      country: 'Unknown', 
      city: 'Unknown',
      regionName: 'Unknown',
      timezone: 'Unknown',
      ip: getClientIP(req)
    };
    
    // Set fallback headers
    setLocationHeaders(res, req.location);
    
    next(); // Continue even if location detection fails
  }
};

/**
 * Get real client IP address
 * Handles various proxy configurations
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.headers['x-client-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * Check if IP is localhost/development IP
 */
function isLocalIP(ip) {
  const localIPs = [
    '127.0.0.1',
    '::1',
    'localhost',
    '::ffff:127.0.0.1',
    'unknown'
  ];
  
  return localIPs.includes(ip) || 
         ip.startsWith('192.168.') || 
         ip.startsWith('10.') ||
         ip.startsWith('172.');
}

/**
 * Set location headers in response
 */
function setLocationHeaders(res, location) {
  res.set({
    'X-User-Country': location.country || 'Unknown',
    'X-User-City': location.city || 'Unknown',
    'X-User-Region': location.regionName || 'Unknown',
    'X-User-Timezone': location.timezone || 'Unknown',
    'X-User-IP': location.ip || 'Unknown'
  });
}

/**
 * Optional: Rate-limited version for high-traffic apps
 */
const locationCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const getLocationFromIPCached = async (req, res, next) => {
  try {
    const ip = getClientIP(req);
    const cacheKey = ip;
    const cached = locationCache.get(cacheKey);
    
    // Use cached data if available and not expired
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      req.location = cached.data;
      setLocationHeaders(res, req.location);
      return next();
    }
    
    // If not cached, fetch and cache
    await getLocationFromIP(req, res, () => {
      // Cache the result
      locationCache.set(cacheKey, {
        data: req.location,
        timestamp: Date.now()
      });
      next();
    });
    
  } catch (error) {
    console.warn('Cached location middleware error:', error.message);
    next();
  }
};

module.exports = {
  getLocationFromIP,
  getLocationFromIPCached,
  getClientIP
};