const express = require('express');
const router = express.Router();

const parcelController = require('./parcel.controller');
const verifyFireBaseToken = require('../../middlewares/verifyFirebaseToken');
const verifyAdmin = require('../../middlewares/verifyAdmin');
const verifyRider = require('../../middlewares/verifyRider');

// GET DELIVERY STATUS STATS — ADMIN ONLY
router.get(
  '/delivery-status/stats',
  verifyFireBaseToken,
  verifyAdmin,
  parcelController.getDeliveryStatusStats,
);

// GET USER DASHBOARD STATS — AUTHENTICATED
router.get(
  '/user-stats',
  verifyFireBaseToken,
  parcelController.getUserDashboardStats,
);

// GET MY PARCELS — AUTHENTICATED
router.get('/', verifyFireBaseToken, parcelController.getParcels);

// GET RIDER ASSIGNED PARCELS — RIDER ONLY
router.get(
  '/rider',
  verifyFireBaseToken,
  verifyRider,
  parcelController.getRiderParcels,
);

// UPDATE DELIVERY STATUS — RIDER ONLY
router.patch(
  '/:id/delivery-status',
  verifyFireBaseToken,
  verifyRider,
  parcelController.updateDeliveryStatus,
);

// ASSIGN RIDER TO PARCEL — ADMIN ONLY
router.patch(
  '/:id',
  verifyFireBaseToken,
  verifyAdmin,
  parcelController.assignRider,
);

// GET SINGLE PARCEL — OWNER OR ADMIN
router.get('/:id', verifyFireBaseToken, parcelController.getParcelById);

// CREATE PARCEL — AUTHENTICATED
router.post('/', verifyFireBaseToken, parcelController.createParcel);

// DELETE PARCEL — OWNER ONLY
router.delete('/:id', verifyFireBaseToken, parcelController.deleteParcel);

module.exports = router;
