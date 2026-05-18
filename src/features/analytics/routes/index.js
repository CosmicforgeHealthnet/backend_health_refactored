const express = require('express');
const router = express.Router();
const { authenticateJWT, authorizeRoles } = require('../../auth/middlewares/authMiddleware');
const trackingCtrl = require('../controllers/trackingController');
const adminCtrl = require('../controllers/adminController');

// Public — receives events from the landing page
router.post('/events', trackingCtrl.track);

// Admin only — all read endpoints
router.use(authenticateJWT);
router.use(authorizeRoles('admin', 'super_admin'));

router.get('/stats', adminCtrl.getStats);
router.get('/visitors', adminCtrl.getVisitors);
router.get('/events', adminCtrl.getEvents);
router.get('/waitlist', adminCtrl.getWaitlist);

module.exports = router;
