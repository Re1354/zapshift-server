const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let serviceAccount;
try {
  serviceAccount = require('../zap-shift-firebase-adminsdk.json');
} catch (error) {
  if (process.env.FB_SERVICE_KEY) {
    const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decoded);
  } else {
    throw error;
  }
}

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

const auth = getAuth();

module.exports = {
  auth,
};
