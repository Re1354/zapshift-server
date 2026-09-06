const { collections, ObjectId } = require('../../config/db');

const getDeliveryPerDay = async (email) => {
  const pipeline = [
    // 1. Find parcels assigned to this rider
    {
      $match: {
        riderEmail: email,
      },
    },

    // 2. Get tracking information
    {
      $lookup: {
        from: 'trackings',
        localField: 'trackingId',
        foreignField: 'trackingId',
        as: 'parcel_trackings',
      },
    },

    // 3. Break tracking array
    {
      $unwind: '$parcel_trackings',
    },

    // 4. Keep only delivered tracking
    {
      $match: {
        'parcel_trackings.status': 'delivered',
      },
    },

    // 5. Group delivered parcels by Bangladesh date
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$parcel_trackings.createdAt',
            timezone: 'Asia/Dhaka',
          },
        },

        delivered: {
          $sum: 1,
        },
      },
    },

    // 6. Sort by date
    {
      $sort: {
        _id: 1,
      },
    },

    // 7. Clean response
    {
      $project: {
        _id: 0,
        date: '$_id',
        delivered: 1,
      },
    },
  ];

  const result = await collections.parcelsCollection.aggregate(pipeline).toArray();

  console.log('Rider:', email);
  console.log('Delivery per day:', result);

  return result;
};

const createRiderApplication = async (body, email) => {
  const existingRider = await collections.ridersCollection.findOne({ email });

  if (existingRider) {
    return { alreadySubmitted: true };
  }

  const riderData = {
    name: body.name.trim(),
    email,
    licenseNumber: body.licenseNumber.trim(),
    region: body.region.trim(),
    district: body.district.trim(),
    nid: body.nid.trim(),
    phone: body.phone.trim(),
    bikeModel: body.bikeModel.trim(),
    bikeRegistration: body.bikeRegistration.trim(),
    about: body.about.trim(),
    status: 'pending',
    createdAt: new Date(),
  };

  const result = await collections.ridersCollection.insertOne(riderData);
  return { alreadySubmitted: false, insertedId: result.insertedId };
};

const getRiders = async ({ status, district, workStatus }) => {
  const query = {};

  if (status) query.status = status;
  if (district) query.district = district;
  if (workStatus) query.workStatus = workStatus;

  const riders = await collections.ridersCollection
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  return riders;
};

const updateRiderStatus = async (id, status) => {
  const rider = await collections.ridersCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!rider) {
    return { notFound: true };
  }

  if (rider.status === status) {
    return { alreadyStatus: true };
  }

  const result = await collections.ridersCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { status, workStatus: 'available', updatedAt: new Date() },
    },
  );

  if (status === 'approved') {
    await collections.userCollection.updateOne(
      { email: rider.email },
      { $set: { role: 'rider', updatedAt: new Date() } },
    );
  }

  return { result };
};

module.exports = {
  getDeliveryPerDay,
  createRiderApplication,
  getRiders,
  updateRiderStatus,
};
