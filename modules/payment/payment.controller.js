const { ObjectId } = require('../../config/db');
const paymentService = require('./payment.service');

const createCheckoutSession = async (req, res) => {
  try {
    const { parcelId } = req.body;

    if (!parcelId || !ObjectId.isValid(parcelId)) {
      return res.status(400).send({
        success: false,
        message: 'Valid parcel ID is required.',
      });
    }

    const result = await paymentService.createCheckoutSession(parcelId, req.decoded_email);

    if (result.notFound) {
      return res
        .status(404)
        .send({ success: false, message: 'Parcel not found.' });
    }

    if (result.forbidden) {
      return res
        .status(403)
        .send({ success: false, message: 'Forbidden access.' });
    }

    if (result.alreadyPaid) {
      return res.status(400).send({
        success: false,
        message: 'This parcel has already been paid.',
      });
    }

    if (result.invalidCost) {
      return res.status(400).send({
        success: false,
        message: 'Invalid parcel payment amount.',
      });
    }

    res.send({ success: true, url: result.sessionUrl });
  } catch (error) {
    console.error('Stripe checkout error:', error.message);
    res.status(500).send({
      success: false,
      message: 'Failed to create Stripe checkout session.',
    });
  }
};

const verifyPaymentSuccess = async (req, res) => {
  try {
    const { session_id: sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).send({
        success: false,
        message: 'Stripe session ID is required.',
      });
    }

    const result = await paymentService.verifyPaymentSuccess(sessionId, req.decoded_email);

    if (result.paymentNotCompleted) {
      return res.status(400).send({
        success: false,
        message: 'Payment has not been completed.',
      });
    }

    if (result.invalidMetadata) {
      return res.status(400).send({
        success: false,
        message: 'Invalid parcel ID in Stripe metadata.',
      });
    }

    if (result.notFound) {
      return res
        .status(404)
        .send({ success: false, message: 'Parcel not found.' });
    }

    if (result.forbidden) {
      return res
        .status(403)
        .send({ success: false, message: 'Forbidden access.' });
    }

    if (result.alreadyPaid) {
      return res.send({
        success: true,
        message: 'Payment has already been verified.',
        trackingId: result.trackingId,
        paymentInfo: result.paymentInfo,
      });
    }

    return res.send({
      success: true,
      message: 'Payment successfully verified.',
      modifyParcel: result.modifyParcel,
      paymentInfo: result.paymentInfo,
      trackingId: result.trackingId,
    });
  } catch (error) {
    console.error('Payment verification error:', error.message);
    return res.status(500).send({
      success: false,
      message: 'Something went wrong while verifying payment.',
    });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const email = req.decoded_email;
    const result = await paymentService.getPaymentHistory(email);
    res.send(result);
  } catch (error) {
    console.error('Get payments error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to fetch payments.' });
  }
};

module.exports = {
  createCheckoutSession,
  verifyPaymentSuccess,
  getPaymentHistory,
};
