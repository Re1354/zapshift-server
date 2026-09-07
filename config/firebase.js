require('dotenv').config();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let serviceAccount;

if (process.env.FB_SERVICE_KEY) {
  try {
    const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to parse FB_SERVICE_KEY from environment:', error.message);
  }
}

if (!serviceAccount) {
  try {
    serviceAccount = require('../zap-shift-firebase-adminsdk.json');
  } catch (error) {
    throw new Error(
      'Firebase Admin credentials not found. Please provide FB_SERVICE_KEY in .env or zap-shift-firebase-adminsdk.json file.'
    );
  }
}

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const auth = getAuth();

module.exports = {
  auth,
};
