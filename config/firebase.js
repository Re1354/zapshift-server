require('dotenv').config();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let serviceAccount = null;

if (process.env.FB_SERVICE_KEY) {
  try {
    const rawKey = process.env.FB_SERVICE_KEY.trim().replace(/^["']|["']$/g, '');
    const decoded = Buffer.from(rawKey, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to parse FB_SERVICE_KEY from environment:', error.message);
  }
}

if (!serviceAccount) {
  try {
    serviceAccount = require('../zap-shift-firebase-adminsdk.json');
  } catch (error) {
    console.warn('Firebase Admin credentials not found during module initialization.');
  }
}

let auth = null;

if (serviceAccount) {
  try {
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    auth = getAuth();
  } catch (error) {
    console.error('Failed to initialize Firebase Admin app:', error.message);
  }
}

if (!auth) {
  auth = {
    verifyIdToken: async () => {
      throw new Error('Firebase Admin not initialized. Please verify FB_SERVICE_KEY.');
    },
  };
}

module.exports = {
  auth,
};

