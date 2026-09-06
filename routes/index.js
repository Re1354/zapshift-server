const express = require('express');
const router = express.Router();

const userRoutes = require('../modules/user/user.routes');
const riderRoutes = require('../modules/rider/rider.routes');
const parcelRoutes = require('../modules/parcel/parcel.routes');
const paymentRoutes = require('../modules/payment/payment.routes');
const trackingRoutes = require('../modules/tracking/tracking.routes');

router.use('/users', userRoutes);
router.use('/riders', riderRoutes);
router.use('/parcels', parcelRoutes);
router.use('/', paymentRoutes);
router.use('/trackings', trackingRoutes);

module.exports = router;
