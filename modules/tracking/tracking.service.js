const { collections, ObjectId } = require('../../config/db');

const getTrackingByTrackingId = async (cleanTrackingId) => {
  const logs = await collections.trackingsCollection
    .find({ trackingId: cleanTrackingId })
    .sort({ createdAt: 1 })
    .toArray();

  if (logs.length === 0) {
    return { notFound: true };
  }

  let parcel = null;
  const parcelId = logs[0]?.parcelId;

  if (parcelId) {
    try {
      parcel = await collections.parcelsCollection.findOne({
        _id: new ObjectId(parcelId),
      });
    } catch (error) {
      console.log('Invalid parcel ID in tracking log:', parcelId);
    }
  }

  return {
    logs,
    parcel,
  };
};

module.exports = {
  getTrackingByTrackingId,
};
