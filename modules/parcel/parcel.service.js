const { collections, ObjectId } = require('../../config/db');
const logTracking = require('../../utils/logTracking');

const getDeliveryStatusStats = async () => {
  const pipeline = [
    {
      $group: {
        _id: '$deliveryStatus',
        count: { $sum: 1 },
      },
    },
  ];
  return await collections.parcelsCollection.aggregate(pipeline).toArray();
};

const getParcels = async (email, deliveryStatus) => {
  const currentUser = await collections.userCollection.findOne({ email });

  if (!currentUser) {
    return { userNotFound: true };
  }

  const query = {};

  if (currentUser.role === 'admin') {
    if (deliveryStatus) query.deliveryStatus = deliveryStatus;
  } else {
    query.userEmail = email;
    if (deliveryStatus) query.deliveryStatus = deliveryStatus;
  }

  const parcels = await collections.parcelsCollection
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  return { parcels };
};

const getRiderParcels = async (riderEmail, deliveryStatus) => {
  const query = { riderEmail };
  if (deliveryStatus) query.deliveryStatus = deliveryStatus;

  return await collections.parcelsCollection
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();
};

const updateDeliveryStatus = async (id, riderEmail, deliveryStatus) => {
  const allowedStatuses = [
    'driver-accepted',
    'driver-rejected',
    'picked-up',
    'in-transit',
    'delivered',
  ];

  if (!allowedStatuses.includes(deliveryStatus)) {
    return { invalidStatus: true };
  }

  const parcel = await collections.parcelsCollection.findOne({
    _id: new ObjectId(id),
    riderEmail,
  });

  if (!parcel) {
    return { notFound: true };
  }

  const currentStatus = parcel.deliveryStatus;

  const validTransitions = {
    'driver-assigned': ['driver-accepted', 'driver-rejected'],
    'driver-accepted': ['picked-up'],
    'picked-up': ['in-transit'],
    'in-transit': ['delivered'],
  };

  if (
    !validTransitions[currentStatus] ||
    !validTransitions[currentStatus].includes(deliveryStatus)
  ) {
    return {
      invalidTransition: true,
      currentStatus,
      deliveryStatus,
    };
  }

  const result = await collections.parcelsCollection.updateOne(
    {
      _id: new ObjectId(id),
      riderEmail,
      deliveryStatus: currentStatus,
    },
    {
      $set: { deliveryStatus, updatedAt: new Date() },
    },
  );

  if (result.matchedCount === 0) {
    return { alreadyChanged: true };
  }

  // Log tracking for every status change
  await logTracking(parcel.trackingId, id, deliveryStatus);

  // Free up rider when rejected or delivered
  if (
    deliveryStatus === 'driver-rejected' ||
    deliveryStatus === 'delivered'
  ) {
    await collections.ridersCollection.updateOne(
      { email: riderEmail },
      { $set: { workStatus: 'available', updatedAt: new Date() } },
    );
  }

  const messages = {
    'driver-accepted': 'Delivery accepted successfully.',
    'driver-rejected': 'Delivery rejected successfully.',
    'picked-up': 'Parcel picked up successfully.',
    'in-transit': 'Parcel is now in transit.',
    delivered: 'Delivery completed successfully.',
  };

  return {
    success: true,
    message: messages[deliveryStatus],
    modifiedCount: result.modifiedCount,
    deliveryStatus,
  };
};

const assignRider = async (id, { riderId, riderName, riderEmail }) => {
  const parcel = await collections.parcelsCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!parcel) {
    return { notFound: true };
  }

  const trackingId = parcel.trackingId;

  const parcelResult = await collections.parcelsCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        deliveryStatus: 'driver-assigned',
        riderId,
        riderName,
        riderEmail,
        updatedAt: new Date(),
      },
    },
  );

  const riderResult = await collections.ridersCollection.updateOne(
    { _id: new ObjectId(riderId) },
    { $set: { workStatus: 'in_delivery', updatedAt: new Date() } },
  );

  if (trackingId) {
    await logTracking(trackingId, id, 'driver-assigned');
  }

  return {
    parcelModifiedCount: parcelResult.modifiedCount,
    riderModifiedCount: riderResult.modifiedCount,
  };
};

const getParcelById = async (id, decodedEmail) => {
  const parcel = await collections.parcelsCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!parcel) {
    return { notFound: true };
  }

  const currentUser = await collections.userCollection.findOne({
    email: decodedEmail,
  });
  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin && parcel.userEmail !== decodedEmail) {
    return { forbidden: true };
  }

  return { parcel };
};

const createParcel = async (body, email) => {
  const parcelData = {
    ...body,
    userEmail: email,
    paymentStatus: 'unpaid',
    createdAt: new Date(),
  };

  const result = await collections.parcelsCollection.insertOne(parcelData);
  return { insertedId: result.insertedId };
};

const deleteParcel = async (id, decodedEmail) => {
  const parcel = await collections.parcelsCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!parcel) {
    return { notFound: true };
  }

  if (parcel.userEmail !== decodedEmail) {
    return { forbidden: true };
  }

  if (parcel.paymentStatus === 'paid') {
    return { paid: true };
  }

  const result = await collections.parcelsCollection.deleteOne({
    _id: new ObjectId(id),
  });

  return { deletedCount: result.deletedCount };
};

module.exports = {
  getDeliveryStatusStats,
  getParcels,
  getRiderParcels,
  updateDeliveryStatus,
  assignRider,
  getParcelById,
  createParcel,
  deleteParcel,
};
