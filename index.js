require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_PAYMENT_SECRET);

// ======================================================
// Firebase Admin SDK
// ======================================================

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const serviceAccount = require('./zap-shift-firebase-adminsdk.json');

initializeApp({ credential: cert(serviceAccount) });

// ======================================================
// App Configuration
// ======================================================

const app = express();
const port = process.env.PORT || 3000;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

// ======================================================
// Security Middleware
// ======================================================

app.use(helmet());

app.use(
  cors({
    origin: clientUrl,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json({ limit: '100kb' }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

app.use(apiLimiter);

// ======================================================
// Parcel Tracking ID Generator
// ======================================================

const generateTrackingId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `PRCL-${timestamp}-${random}`;
};

// ======================================================
// Firebase Token Verification Middleware
// ======================================================

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

    const decoded = await getAuth().verifyIdToken(idToken);
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

// ======================================================
// MongoDB Configuration
// ======================================================

const uri =
  `mongodb+srv://${process.env.DB_USER}:` +
  `${process.env.DB_PASS}` +
  `@cluster0.1zqbczf.mongodb.net/` +
  `?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ======================================================
// Root Route
// ======================================================

app.get('/', (req, res) => {
  res.send('Zap Shift Server is Running!');
});

// ======================================================
// Main Server
// ======================================================

async function run() {
  try {
    await client.connect();

    const db = client.db('zap_shift_db');

    const userCollection = db.collection('users');
    const parcelsCollection = db.collection('parcels');
    const ridersCollection = db.collection('riders');
    const paymentCollection = db.collection('payments');
    const trackingsCollection = db.collection('trackings');

    // ==================================================
    // Admin Verification Middleware
    // ==================================================

    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.decoded_email;

        if (!email) {
          return res
            .status(401)
            .send({ success: false, message: 'Unauthorized access.' });
        }

        const user = await userCollection.findOne({ email });

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

    // ==================================================
    // Rider Verification Middleware
    // ==================================================

    const verifyRider = async (req, res, next) => {
      try {
        const email = req.decoded_email;

        if (!email) {
          return res
            .status(401)
            .send({ success: false, message: 'Unauthorized access.' });
        }

        const rider = await ridersCollection.findOne({ email });

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

    // ==================================================
    // ✅ logTracking — now includes parcelId
    // ==================================================

    const logTracking = async (trackingId, parcelId, status) => {
      try {
        const log = {
          trackingId,
          parcelId: parcelId || null,
          status,
          details: status.split('-').join(' '),
          createdAt: new Date(),
        };
        await trackingsCollection.insertOne(log);
      } catch (error) {
        console.error('Tracking log error:', error.message);
      }
    };

    // ==================================================
    // MongoDB Indexes
    // ==================================================

    await userCollection.createIndex({ email: 1 }, { unique: true });
    await ridersCollection.createIndex({ email: 1 }, { unique: true });
    await paymentCollection.createIndex(
      { transactionId: 1 },
      { unique: true, sparse: true },
    );
    await trackingsCollection.createIndex({ trackingId: 1 });

    // ==================================================
    // USER API
    // ==================================================

    // GET ALL USERS — ADMIN ONLY
    app.get('/users', verifyFireBaseToken, verifyAdmin, async (req, res) => {
      try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(
          Math.max(parseInt(req.query.limit, 10) || 10, 1),
          50,
        );
        const search = (req.query.search || '').trim();

        const filter = {};

        if (search) {
          const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const searchRegex = new RegExp(escapedSearch, 'i');
          filter.$or = [{ displayName: searchRegex }, { email: searchRegex }];
        }

        const skip = (page - 1) * limit;

        const [users, totalUsers, riderUsers, adminUsers] = await Promise.all([
          userCollection
            .find(filter, {
              projection: {
                email: 1,
                displayName: 1,
                photoURL: 1,
                role: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),

          userCollection.countDocuments({}),
          userCollection.countDocuments({ role: 'rider' }),
          userCollection.countDocuments({ role: 'admin' }),
        ]);

        const totalPages = Math.max(Math.ceil(totalUsers / limit), 1);

        res.send({
          users,
          totalUsers,
          riderUsers,
          adminUsers,
          totalPages,
          currentPage: page,
          limit,
          search,
        });
      } catch (error) {
        console.error('Get users error:', error.message);
        res
          .status(500)
          .send({ success: false, message: 'Failed to fetch users.' });
      }
    });

    // GET CURRENT USER ROLE — AUTHENTICATED
    app.get('/users/role', verifyFireBaseToken, async (req, res) => {
      try {
        const email = req.decoded_email;
        const user = await userCollection.findOne({ email });
        res.send({ role: user?.role || 'user' });
      } catch (error) {
        console.error('Get user role error:', error.message);
        res
          .status(500)
          .send({ success: false, message: 'Failed to get user role.' });
      }
    });

    // GET SINGLE USER — ADMIN ONLY
    app.get(
      '/users/:id',
      verifyFireBaseToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;

          if (!ObjectId.isValid(id)) {
            return res
              .status(400)
              .send({ success: false, message: 'Invalid user ID.' });
          }

          const user = await userCollection.findOne(
            { _id: new ObjectId(id) },
            {
              projection: {
                email: 1,
                displayName: 1,
                photoURL: 1,
                role: 1,
                createdAt: 1,
                updatedAt: 1,
              },
            },
          );

          if (!user) {
            return res
              .status(404)
              .send({ success: false, message: 'User not found.' });
          }

          res.send(user);
        } catch (error) {
          console.error('Get single user error:', error.message);
          res
            .status(500)
            .send({ success: false, message: 'Failed to fetch user.' });
        }
      },
    );

    // CREATE USER — AUTHENTICATED
    app.post('/users', verifyFireBaseToken, async (req, res) => {
      try {
        const body = req.body;
        const email = req.decoded_email;

        const userExists = await userCollection.findOne({ email });

        if (userExists) {
          return res.send({ success: true, message: 'User already exists.' });
        }

        const userData = {
          email,
          displayName: body.displayName || '',
          photoURL: body.photoURL || '',
          role: 'user',
          createdAt: new Date(),
        };

        const result = await userCollection.insertOne(userData);

        res.status(201).send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        console.error('Create user error:', error.message);
        res
          .status(500)
          .send({ success: false, message: 'Failed to create user.' });
      }
    });

    // UPDATE USER ROLE — ADMIN ONLY
    app.patch(
      '/users/:id/role',
      verifyFireBaseToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;
          const { role } = req.body;

          if (!ObjectId.isValid(id)) {
            return res
              .status(400)
              .send({ success: false, message: 'Invalid user ID.' });
          }

          if (!['admin', 'user'].includes(role)) {
            return res
              .status(400)
              .send({ success: false, message: 'Invalid role.' });
          }

          const targetUser = await userCollection.findOne({
            _id: new ObjectId(id),
          });

          if (!targetUser) {
            return res
              .status(404)
              .send({ success: false, message: 'User not found.' });
          }

          if (targetUser.email === req.decoded_email && role !== 'admin') {
            return res.status(400).send({
              success: false,
              message: 'You cannot remove your own admin role.',
            });
          }

          const result = await userCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { role, updatedAt: new Date() } },
          );

          res.send({
            success: true,
            message:
              role === 'admin'
                ? 'User has been promoted to admin successfully.'
                : 'Admin role has been removed successfully.',
            result,
          });
        } catch (error) {
          console.error('Update user role error:', error.message);
          res
            .status(500)
            .send({ success: false, message: 'Failed to update user role.' });
        }
      },
    );

    // ==================================================
    // RIDER API
    // ==================================================
    app.get(
      '/riders/delivery-per-day',
      verifyFireBaseToken,
      verifyRider,
      async (req, res) => {
        try {
          const email = req.query.email;

          if (!email) {
            return res.status(400).send({
              success: false,
              message: 'Rider email is required.',
            });
          }

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

          const result = await parcelsCollection.aggregate(pipeline).toArray();

          console.log('Rider:', email);
          console.log('Delivery per day:', result);

          res.send(result);
        } catch (error) {
          console.error('Delivery per day error:', error.message);

          res.status(500).send({
            success: false,
            message: 'Failed to get delivery data.',
          });
        }
      },
    );
    // CREATE RIDER APPLICATION — AUTHENTICATED
    app.post('/riders', verifyFireBaseToken, async (req, res) => {
      try {
        const body = req.body;
        const email = req.decoded_email;

        if (
          !body.name ||
          !body.licenseNumber ||
          !body.region ||
          !body.district ||
          !body.nid ||
          !body.phone ||
          !body.bikeModel ||
          !body.bikeRegistration ||
          !body.about
        ) {
          return res.status(400).send({
            success: false,
            message: 'All rider information is required.',
          });
        }

        const existingRider = await ridersCollection.findOne({ email });

        if (existingRider) {
          return res.status(409).send({
            success: false,
            message: 'You have already submitted a rider application.',
          });
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

        const result = await ridersCollection.insertOne(riderData);

        res.status(201).send({
          success: true,
          message: 'Rider application submitted successfully.',
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error('Create rider application error:', error.message);

        if (error.code === 11000) {
          return res.status(409).send({
            success: false,
            message: 'You have already submitted a rider application.',
          });
        }

        res.status(500).send({
          success: false,
          message: 'Failed to submit rider application.',
        });
      }
    });

    // GET ALL RIDERS — ADMIN ONLY
    app.get('/riders', verifyFireBaseToken, verifyAdmin, async (req, res) => {
      try {
        const { status, district, workStatus } = req.query;
        const query = {};

        if (status) query.status = status;
        if (district) query.district = district;
        if (workStatus) query.workStatus = workStatus;

        const riders = await ridersCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();

        res.send({ success: true, riders });
      } catch (error) {
        console.error('Get riders error:', error.message);
        res
          .status(500)
          .send({ success: false, message: 'Failed to get riders.' });
      }
    });

    // UPDATE RIDER STATUS — ADMIN ONLY
    app.patch(
      '/riders/:id',
      verifyFireBaseToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { status } = req.body;
          const { id } = req.params;

          if (!['approved', 'rejected'].includes(status)) {
            return res
              .status(400)
              .send({ success: false, message: 'Invalid rider status.' });
          }

          if (!ObjectId.isValid(id)) {
            return res
              .status(400)
              .send({ success: false, message: 'Invalid rider ID.' });
          }

          const rider = await ridersCollection.findOne({
            _id: new ObjectId(id),
          });

          if (!rider) {
            return res
              .status(404)
              .send({ success: false, message: 'Rider not found.' });
          }

          if (rider.status === status) {
            return res.send({
              success: true,
              message: `Rider is already ${status}.`,
            });
          }

          const result = await ridersCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $set: { status, workStatus: 'available', updatedAt: new Date() },
            },
          );

          if (status === 'approved') {
            await userCollection.updateOne(
              { email: rider.email },
              { $set: { role: 'rider', updatedAt: new Date() } },
            );
          }

          res.send({
            success: true,
            message:
              status === 'approved'
                ? 'Rider approved and user role updated successfully.'
                : 'Rider application rejected successfully.',
            result,
          });
        } catch (error) {
          console.error('Update rider status error:', error.message);
          res.status(500).send({
            success: false,
            message: 'Failed to update rider status.',
          });
        }
      },
    );

    // ==================================================
    // PARCEL API
    // ==================================================

    app.get(
      '/parcels/delivery-status/stats',
      verifyFireBaseToken,
      verifyAdmin,
      async (req, res) => {
        const pipeline = [
          {
            $group: {
              _id: '$deliveryStatus',
              count: { $sum: 1 },
            },
          },
        ];
        const result = await parcelsCollection.aggregate(pipeline).toArray();
        res.send(result);
      },
    );

    // GET MY PARCELS — AUTHENTICATED
    app.get('/parcels', verifyFireBaseToken, async (req, res) => {
      try {
        const email = req.decoded_email;
        const { deliveryStatus } = req.query;

        const currentUser = await userCollection.findOne({ email });

        if (!currentUser) {
          return res
            .status(404)
            .send({ success: false, message: 'User not found.' });
        }

        const query = {};

        if (currentUser.role === 'admin') {
          if (deliveryStatus) query.deliveryStatus = deliveryStatus;
        } else {
          query.userEmail = email;
          if (deliveryStatus) query.deliveryStatus = deliveryStatus;
        }

        const result = await parcelsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        console.error('Get parcels error:', error.message);
        res
          .status(500)
          .send({ success: false, message: 'Failed to fetch parcels.' });
      }
    });

    // GET RIDER ASSIGNED PARCELS — RIDER ONLY
    app.get(
      '/parcels/rider',
      verifyFireBaseToken,
      verifyRider,
      async (req, res) => {
        try {
          const riderEmail = req.decoded_email;
          const { deliveryStatus } = req.query;

          const query = { riderEmail };
          if (deliveryStatus) query.deliveryStatus = deliveryStatus;

          const result = await parcelsCollection
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();
          res.send(result);
        } catch (error) {
          console.error('Get rider parcels error:', error.message);
          res
            .status(500)
            .send({ success: false, message: 'Failed to get rider parcels.' });
        }
      },
    );

    // ==================================================
    // ✅ UPDATE DELIVERY STATUS — RIDER ONLY
    // ✅ Single route — removed duplicate
    // ✅ Tracking logged for every status
    // ==================================================

    app.patch(
      '/parcels/:id/delivery-status',
      verifyFireBaseToken,
      verifyRider,
      async (req, res) => {
        try {
          const { deliveryStatus } = req.body;
          const id = req.params.id;
          const riderEmail = req.decoded_email;

          // Allowed statuses
          const allowedStatuses = [
            'driver-accepted',
            'driver-rejected',
            'picked-up',
            'in-transit',
            'delivered',
          ];

          if (!allowedStatuses.includes(deliveryStatus)) {
            return res
              .status(400)
              .send({ success: false, message: 'Invalid delivery status.' });
          }

          if (!ObjectId.isValid(id)) {
            return res
              .status(400)
              .send({ success: false, message: 'Invalid parcel ID.' });
          }

          const parcel = await parcelsCollection.findOne({
            _id: new ObjectId(id),
            riderEmail,
          });

          if (!parcel) {
            return res
              .status(404)
              .send({ success: false, message: 'Parcel not found.' });
          }

          const currentStatus = parcel.deliveryStatus;

          // Valid state transitions
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
            return res.status(400).send({
              success: false,
              message: `Cannot change status from "${currentStatus}" to "${deliveryStatus}".`,
            });
          }

          const result = await parcelsCollection.updateOne(
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
            return res.status(404).send({
              success: false,
              message: 'Parcel status has already changed.',
            });
          }

          // ✅ Log tracking for every status change
          await logTracking(parcel.trackingId, id, deliveryStatus);

          // ✅ Free up rider when rejected or delivered
          if (
            deliveryStatus === 'driver-rejected' ||
            deliveryStatus === 'delivered'
          ) {
            await ridersCollection.updateOne(
              { email: riderEmail },
              { $set: { workStatus: 'available', updatedAt: new Date() } },
            );
          }

          // Status messages
          const messages = {
            'driver-accepted': 'Delivery accepted successfully.',
            'driver-rejected': 'Delivery rejected successfully.',
            'picked-up': 'Parcel picked up successfully.',
            'in-transit': 'Parcel is now in transit.',
            delivered: 'Delivery completed successfully.',
          };

          res.send({
            success: true,
            message: messages[deliveryStatus],
            modifiedCount: result.modifiedCount,
            deliveryStatus,
          });
        } catch (error) {
          console.error('Update delivery status error:', error.message);
          res.status(500).send({
            success: false,
            message: 'Failed to update delivery status.',
          });
        }
      },
    );

    // ==================================================
    // ✅ ASSIGN RIDER TO PARCEL — ADMIN
    // ✅ trackingId now fetched from DB, not from frontend
    // ==================================================

    app.patch(
      '/parcels/:id',
      verifyFireBaseToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { riderId, riderName, riderEmail } = req.body;
          const id = req.params.id;

          if (!ObjectId.isValid(id)) {
            return res
              .status(400)
              .send({ success: false, message: 'Invalid parcel ID.' });
          }

          if (!ObjectId.isValid(riderId)) {
            return res
              .status(400)
              .send({ success: false, message: 'Invalid rider ID.' });
          }

          // ✅ Get trackingId from DB — not from frontend
          const parcel = await parcelsCollection.findOne({
            _id: new ObjectId(id),
          });

          if (!parcel) {
            return res
              .status(404)
              .send({ success: false, message: 'Parcel not found.' });
          }

          const trackingId = parcel.trackingId;

          const parcelResult = await parcelsCollection.updateOne(
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

          const riderResult = await ridersCollection.updateOne(
            { _id: new ObjectId(riderId) },
            { $set: { workStatus: 'in_delivery', updatedAt: new Date() } },
          );

          // ✅ Log tracking with parcelId
          if (trackingId) {
            await logTracking(trackingId, id, 'driver-assigned');
          }

          res.send({
            success: true,
            message: 'Rider assigned successfully.',
            parcelModifiedCount: parcelResult.modifiedCount,
            riderModifiedCount: riderResult.modifiedCount,
          });
        } catch (error) {
          console.error('Assign rider error:', error.message);
          res
            .status(500)
            .send({ success: false, message: 'Failed to assign rider.' });
        }
      },
    );

    // GET SINGLE PARCEL — OWNER OR ADMIN
    app.get('/parcels/:id', verifyFireBaseToken, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: 'Invalid parcel ID.' });
        }

        const parcel = await parcelsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!parcel) {
          return res
            .status(404)
            .send({ success: false, message: 'Parcel not found.' });
        }

        const currentUser = await userCollection.findOne({
          email: req.decoded_email,
        });
        const isAdmin = currentUser?.role === 'admin';

        if (!isAdmin && parcel.userEmail !== req.decoded_email) {
          return res
            .status(403)
            .send({ success: false, message: 'Forbidden access.' });
        }

        res.send(parcel);
      } catch (error) {
        console.error('Get single parcel error:', error.message);
        res
          .status(500)
          .send({ success: false, message: 'Failed to fetch parcel.' });
      }
    });

    // CREATE PARCEL — AUTHENTICATED
    app.post('/parcels', verifyFireBaseToken, async (req, res) => {
      try {
        const body = req.body;
        const email = req.decoded_email;

        if (!body.parcelName || !body.cost) {
          return res.status(400).send({
            success: false,
            message: 'Parcel name and cost are required.',
          });
        }

        const numericCost = Number(body.cost);

        if (!Number.isFinite(numericCost) || numericCost <= 0) {
          return res
            .status(400)
            .send({ success: false, message: 'Invalid parcel cost.' });
        }

        const parcelData = {
          ...body,
          userEmail: email,
          paymentStatus: 'unpaid',
          createdAt: new Date(),
        };

        const result = await parcelsCollection.insertOne(parcelData);

        res.status(201).send({ success: true, insertedId: result.insertedId });
      } catch (error) {
        console.error('Create parcel error:', error.message);
        res
          .status(500)
          .send({ success: false, message: 'Failed to create parcel.' });
      }
    });

    // DELETE PARCEL — OWNER ONLY
    app.delete('/parcels/:id', verifyFireBaseToken, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ success: false, message: 'Invalid parcel ID.' });
        }

        const parcel = await parcelsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!parcel) {
          return res
            .status(404)
            .send({ success: false, message: 'Parcel not found.' });
        }

        if (parcel.userEmail !== req.decoded_email) {
          return res
            .status(403)
            .send({ success: false, message: 'Forbidden access.' });
        }

        if (parcel.paymentStatus === 'paid') {
          return res.status(400).send({
            success: false,
            message: 'Paid parcels cannot be deleted.',
          });
        }

        const result = await parcelsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({ success: true, deletedCount: result.deletedCount });
      } catch (error) {
        console.error('Delete parcel error:', error.message);
        res
          .status(500)
          .send({ success: false, message: 'Failed to delete parcel.' });
      }
    });

    // ==================================================
    // PAYMENT API
    // ==================================================

    // CREATE STRIPE CHECKOUT SESSION — AUTHENTICATED + OWNER
    app.post(
      '/payment-checkout-session',
      verifyFireBaseToken,
      async (req, res) => {
        try {
          const { parcelId } = req.body;

          if (!parcelId || !ObjectId.isValid(parcelId)) {
            return res.status(400).send({
              success: false,
              message: 'Valid parcel ID is required.',
            });
          }

          const parcel = await parcelsCollection.findOne({
            _id: new ObjectId(parcelId),
          });

          if (!parcel) {
            return res
              .status(404)
              .send({ success: false, message: 'Parcel not found.' });
          }

          if (parcel.userEmail !== req.decoded_email) {
            return res
              .status(403)
              .send({ success: false, message: 'Forbidden access.' });
          }

          if (parcel.paymentStatus === 'paid') {
            return res.status(400).send({
              success: false,
              message: 'This parcel has already been paid.',
            });
          }

          const numericCost = Number(parcel.cost);

          if (!Number.isFinite(numericCost) || numericCost <= 0) {
            return res.status(400).send({
              success: false,
              message: 'Invalid parcel payment amount.',
            });
          }

          const amount = Math.round(numericCost * 100);

          const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
              {
                price_data: {
                  currency: 'usd',
                  unit_amount: amount,
                  product_data: {
                    name: `Please pay for: ${parcel.parcelName || 'Parcel'}`,
                  },
                },
                quantity: 1,
              },
            ],
            mode: 'payment',
            metadata: { parcelId },
            customer_email: req.decoded_email,
            success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
          });

          res.send({ success: true, url: session.url });
        } catch (error) {
          console.error('Stripe checkout error:', error.message);
          res.status(500).send({
            success: false,
            message: 'Failed to create Stripe checkout session.',
          });
        }
      },
    );

    // PAYMENT SUCCESS / VERIFY — AUTHENTICATED + OWNER
    app.patch('/payment-success', verifyFireBaseToken, async (req, res) => {
      try {
        const { session_id: sessionId } = req.query;

        if (!sessionId) {
          return res.status(400).send({
            success: false,
            message: 'Stripe session ID is required.',
          });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
          return res.status(400).send({
            success: false,
            message: 'Payment has not been completed.',
          });
        }

        const parcelId = session.metadata?.parcelId;

        if (!parcelId || !ObjectId.isValid(parcelId)) {
          return res.status(400).send({
            success: false,
            message: 'Invalid parcel ID in Stripe metadata.',
          });
        }

        const parcel = await parcelsCollection.findOne({
          _id: new ObjectId(parcelId),
        });

        if (!parcel) {
          return res
            .status(404)
            .send({ success: false, message: 'Parcel not found.' });
        }

        const stripeEmail =
          session.customer_details?.email || session.customer_email;

        if (
          stripeEmail &&
          stripeEmail.toLowerCase() !== req.decoded_email.toLowerCase()
        ) {
          return res
            .status(403)
            .send({ success: false, message: 'Forbidden access.' });
        }

        if (parcel.userEmail !== req.decoded_email) {
          return res
            .status(403)
            .send({ success: false, message: 'Forbidden access.' });
        }

        // Already paid — return existing data
        if (parcel.paymentStatus === 'paid') {
          const existingPayment = session.payment_intent
            ? await paymentCollection.findOne({
                transactionId: session.payment_intent,
              })
            : null;

          return res.send({
            success: true,
            message: 'Payment has already been verified.',
            trackingId: parcel.trackingId || null,
            paymentInfo: existingPayment || null,
          });
        }

        const trackingId = parcel.trackingId || generateTrackingId();

        const modifyParcel = await parcelsCollection.updateOne(
          { _id: new ObjectId(parcelId), paymentStatus: { $ne: 'paid' } },
          {
            $set: {
              paymentStatus: 'paid',
              deliveryStatus: 'pending-pickup',
              trackingId,
              paidAt: new Date(),
            },
          },
        );

        const transactionId = session.payment_intent;
        let paymentInfo = null;

        if (transactionId) {
          const existingPayment = await paymentCollection.findOne({
            transactionId,
          });

          if (existingPayment) {
            paymentInfo = existingPayment;
          } else {
            const payment = {
              amount: session.amount_total ? session.amount_total / 100 : 0,
              currency: session.currency || 'usd',
              customerEmail: req.decoded_email,
              parcelId,
              parcelName: parcel.parcelName || '',
              transactionId,
              paymentStatus: session.payment_status,
              paidAt: new Date(),
              trackingId,
            };

            try {
              const paymentResult = await paymentCollection.insertOne(payment);

              // ✅ Log tracking with parcelId
              await logTracking(trackingId, parcelId, 'pending-pickup');

              paymentInfo = { insertedId: paymentResult.insertedId };
            } catch (err) {
              if (err.code === 11000) {
                paymentInfo = await paymentCollection.findOne({
                  transactionId,
                });
              } else {
                throw err;
              }
            }
          }
        }

        return res.send({
          success: true,
          message: 'Payment successfully verified.',
          modifyParcel,
          paymentInfo,
          trackingId,
        });
      } catch (error) {
        console.error('Payment verification error:', error.message);
        return res.status(500).send({
          success: false,
          message: 'Something went wrong while verifying payment.',
        });
      }
    });

    // GET PAYMENT HISTORY — AUTHENTICATED
    app.get('/payments', verifyFireBaseToken, async (req, res) => {
      try {
        const email = req.decoded_email;

        const result = await paymentCollection
          .find({ customerEmail: email })
          .sort({ paidAt: -1 })
          .toArray();

        res.send(result);
      } catch (error) {
        console.error('Get payments error:', error.message);
        res
          .status(500)
          .send({ success: false, message: 'Failed to fetch payments.' });
      }
    });

    // ==================================================
    // ✅ TRACKING API — PUBLIC
    // GET /trackings/:trackingId
    // ==================================================

    app.get('/trackings/:trackingId', async (req, res) => {
      try {
        const { trackingId } = req.params;

        if (!trackingId || trackingId.trim() === '') {
          return res.status(400).send({
            success: false,
            message: 'Tracking ID is required.',
          });
        }

        const cleanTrackingId = trackingId.trim().toUpperCase();

        const logs = await trackingsCollection
          .find({ trackingId: cleanTrackingId })
          .sort({ createdAt: 1 })
          .toArray();

        if (logs.length === 0) {
          return res.status(404).send({
            success: false,
            message: 'No tracking information found.',
          });
        }

        let parcel = null;

        const parcelId = logs[0]?.parcelId;

        if (parcelId) {
          try {
            parcel = await parcelsCollection.findOne({
              _id: new ObjectId(parcelId),
            });
          } catch (error) {
            console.log('Invalid parcel ID in tracking log:', parcelId);
          }
        }

        res.send({
          success: true,
          trackingId: cleanTrackingId,
          parcel,
          logs,
        });
      } catch (error) {
        console.error('Get tracking error:', error.message);

        res.status(500).send({
          success: false,
          message: 'Failed to fetch tracking info.',
        });
      }
    });

    // ==================================================
    // MongoDB Health Check
    // ==================================================

    await client.db('admin').command({ ping: 1 });
    console.log('MongoDB connected successfully!');

    app.listen(port, () => {
      console.log(`Zap Shift server is running on port ${port}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error);
  }
}

run();

// ======================================================
// Graceful Shutdown
// ======================================================

process.on('SIGINT', async () => {
  try {
    await client.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
    process.exit(1);
  }
});
