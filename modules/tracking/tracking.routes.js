const express = require('express');
const router = express.Router();

const trackingController = require('./tracking.controller');

// GET TRACKING INFO — PUBLIC
router.get('/:trackingId', trackingController.getTracking);

module.exports = router;
