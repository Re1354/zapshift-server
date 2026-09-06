const express = require('express');
const router = express.Router();

const paymentController = require('./payment.controller');
const verifyFireBaseToken = require('../../middlewares/verifyFirebaseToken');

// CREATE STRIPE CHECKOUT SESSION — AUTHENTICATED + OWNER
router.post(
  '/payment-checkout-session',
  verifyFireBaseToken,
  paymentController.createCheckoutSession,
);

// PAYMENT SUCCESS / VERIFY — AUTHENTICATED + OWNER
router.patch(
  '/payment-success',
  verifyFireBaseToken,
  paymentController.verifyPaymentSuccess,
);

// GET PAYMENT HISTORY — AUTHENTICATED
router.get(
  '/payments',
  verifyFireBaseToken,
  paymentController.getPaymentHistory,
);

module.exports = router;
