const router = require('express').Router();
const marketingRoutes = require('./marketingRoutes');
const waitlistRoutes = require('./waitlistRoutes');
const spinningWheelRoutes = require('./spinningWheelRoutes');

router.use('/', marketingRoutes);
router.use('/waitlist', waitlistRoutes);
router.use('/spin', spinningWheelRoutes);

module.exports = router;
