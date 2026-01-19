// src/features/compliance/routes/index.js
const express = require('express');
const auditRoutes = require('./auditRoutes');
const complianceRoutes = require('./complianceRoutes');
const consentRoutes = require('./consentRoutes');
const dataGovernanceRoutes = require('./dataGovernanceRoutes');

const router = express.Router();

router.use('/audit', auditRoutes);
router.use('/', complianceRoutes); // Base compliance routes
router.use('/consent', consentRoutes);
router.use('/governance', dataGovernanceRoutes);

module.exports = router;
