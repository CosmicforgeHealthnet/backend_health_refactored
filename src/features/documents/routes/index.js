const express = require('express');
const documentRoutes = require('./documents');
const fileRoutes = require('./files');

const router = express.Router();

router.use('/documents', documentRoutes);
router.use('/files', fileRoutes);
router.use('/fhir', require('./fhirRoutes'));

module.exports = router;
