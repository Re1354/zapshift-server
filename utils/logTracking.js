const { collections } = require('../config/db');

const logTracking = async (trackingId, parcelId, status) => {
  try {
    const log = {
      trackingId,
      parcelId: parcelId || null,
      status,
      details: status.split('-').join(' '),
      createdAt: new Date(),
    };
    await collections.trackingsCollection.insertOne(log);
  } catch (error) {
    console.error('Tracking log error:', error.message);
  }
};

module.exports = logTracking;
