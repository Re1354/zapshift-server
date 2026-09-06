const { collections } = require('../config/db');

const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.decoded_email;

    if (!email) {
      return res
        .status(401)
        .send({ success: false, message: 'Unauthorized access.' });
    }

    const user = await collections.userCollection.findOne({ email });

    if (!user || user.role !== 'admin') {
      return res
        .status(403)
        .send({ success: false, message: 'Forbidden access.' });
    }

    next();
  } catch (error) {
    console.error('Admin verification error:', error.message);
    return res
      .status(500)
      .send({ success: false, message: 'Failed to verify admin access.' });
  }
};

module.exports = verifyAdmin;
