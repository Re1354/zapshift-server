const { collections } = require('../config/db');

const verifyRider = async (req, res, next) => {
  try {
    const email = req.decoded_email;

    if (!email) {
      return res
        .status(401)
        .send({ success: false, message: 'Unauthorized access.' });
    }

    const rider = await collections.ridersCollection.findOne({ email });

    if (!rider || rider.status !== 'approved') {
      return res
        .status(403)
        .send({ success: false, message: 'Forbidden access.' });
    }

    next();
  } catch (error) {
    console.error('Rider verification error:', error.message);
    return res
      .status(500)
      .send({ success: false, message: 'Failed to verify rider access.' });
  }
};

module.exports = verifyRider;
