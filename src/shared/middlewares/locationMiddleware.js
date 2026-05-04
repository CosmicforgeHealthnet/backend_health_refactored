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

    // countryCode: null so downstream code can reliably detect "unknown location"
    req.location = {
      country: 'Unknown',
      countryCode: null,
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
 * Check if IP is localhost/private/development IP
 */
function isLocalIP(ip) {
  const localIPs = [
    '127.0.0.1',
    '::1',
    'localhost',
    '::ffff:127.0.0.1',
    'unknown'
  ];

  if (localIPs.includes(ip)) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('10.')) return true;

  // Only 172.16.0.0 – 172.31.255.255 is private (not all of 172.x)
  const parts = ip.split('.');
  if (parts[0] === '172') {
    const second = parseInt(parts[1], 10);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
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

const locationCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const MAX_CACHE_SIZE = 5000;            // evict oldest when over this limit

const getLocationFromIPCached = async (req, res, next) => {
  try {
    const ip = getClientIP(req);
    const cached = locationCache.get(ip);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      req.location = cached.data;
      setLocationHeaders(res, req.location);
      return next();
    }

    await getLocationFromIP(req, res, () => {
      // Evict oldest entry if cache is full
      if (locationCache.size >= MAX_CACHE_SIZE) {
        const oldestKey = locationCache.keys().next().value;
        locationCache.delete(oldestKey);
      }
      locationCache.set(ip, { data: req.location, timestamp: Date.now() });
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