const express = require('express');
const router = express.Router();

const riderController = require('./rider.controller');
const verifyFireBaseToken = require('../../middlewares/verifyFirebaseToken');
const verifyAdmin = require('../../middlewares/verifyAdmin');
const verifyRider = require('../../middlewares/verifyRider');

// GET RIDER DELIVERIES PER DAY — RIDER ONLY
router.get(
  '/delivery-per-day',
  verifyFireBaseToken,
  verifyRider,
  riderController.getDeliveryPerDay,
);

// CREATE RIDER APPLICATION — AUTHENTICATED
router.post('/', verifyFireBaseToken, riderController.createRiderApplication);

// GET ALL RIDERS — ADMIN ONLY
router.get('/', verifyFireBaseToken, verifyAdmin, riderController.getAllRiders);

// UPDATE RIDER STATUS — ADMIN ONLY
router.patch(
  '/:id',
  verifyFireBaseToken,
  verifyAdmin,
  riderController.updateRiderStatus,
);

module.exports = router;
