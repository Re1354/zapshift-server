require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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

let db;

const connectDB = async () => {
  if (!db) {
    await client.connect();
    db = client.db('zap_shift_db');
  }
  return db;
};

const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return db;
};

const collections = {
  get userCollection() {
    return getDB().collection('users');
  },
  get parcelsCollection() {
    return getDB().collection('parcels');
  },
  get ridersCollection() {
    return getDB().collection('riders');
  },
  get paymentCollection() {
    return getDB().collection('payments');
  },
  get trackingsCollection() {
    return getDB().collection('trackings');
  },
};

const initIndexes = async () => {
  await collections.userCollection.createIndex({ email: 1 }, { unique: true });
  await collections.ridersCollection.createIndex({ email: 1 }, { unique: true });
  await collections.paymentCollection.createIndex(
    { transactionId: 1 },
    { unique: true, sparse: true },
  );
  await collections.trackingsCollection.createIndex({ trackingId: 1 });
};

const closeDB = async () => {
  await client.close();
};

module.exports = {
  client,
  connectDB,
  getDB,
  collections,
  initIndexes,
  closeDB,
  ObjectId,
};
