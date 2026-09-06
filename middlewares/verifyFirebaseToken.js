const { auth } = require('../config/firebase');

const verifyFireBaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res
      .status(401)
      .send({ success: false, message: 'Unauthorized access.' });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .send({ success: false, message: 'Invalid authorization format.' });
  }

  try {
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!idToken) {
      return res
        .status(401)
        .send({ success: false, message: 'Token is missing.' });
    }

    const decoded = await auth.verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    req.decoded_uid = decoded.uid;

    next();
  } catch (error) {
    console.error('Firebase token verification error:', error.message);
    return res
      .status(401)
      .send({ success: false, message: 'Unauthorized access.' });
  }
};

module.exports = verifyFireBaseToken;
