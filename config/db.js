require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const rawUser = process.env.DB_USER ? process.env.DB_USER.trim().replace(/^["']|["']$/g, '') : '';
const rawPass = process.env.DB_PASS ? process.env.DB_PASS.trim().replace(/^["']|["']$/g, '') : '';
const user = encodeURIComponent(rawUser);
const pass = encodeURIComponent(rawPass);

const directHosts = [
  'ac-aanrsld-shard-00-00.1zqbczf.mongodb.net:27017',
  'ac-aanrsld-shard-00-01.1zqbczf.mongodb.net:27017',
  'ac-aanrsld-shard-00-02.1zqbczf.mongodb.net:27017',
].join(',');

const defaultUri = process.env.VERCEL
  ? `mongodb+srv://${user}:${pass}@cluster0.1zqbczf.mongodb.net/zap_shift_db?retryWrites=true&w=majority`
  : `mongodb://${user}:${pass}@${directHosts}/zap_shift_db?ssl=true&authSource=admin&retryWrites=true&w=majority`;

const uri = process.env.MONGODB_URI || defaultUri;

let client = null;

const createClient = (connUri) => {
  return new MongoClient(connUri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
};

const getClient = () => {
  if (client) return client;
  if (!user && !process.env.MONGODB_URI) {
    throw new Error('Database credentials missing: DB_USER and DB_PASS are required.');
  }
  client = createClient(uri);
  return client;
};

let db = null;

const connectDB = async () => {
  if (db) return db;

  if (!user && !process.env.MONGODB_URI) {
    throw new Error('Database credentials missing: DB_USER and DB_PASS are required in environment.');
  }

  const cli = getClient();

  try {
    await cli.connect();
    db = cli.db('zap_shift_db');
    return db;
  } catch (primaryErr) {
    console.warn('Primary MongoDB connection failed, attempting fallback...', primaryErr.message);
    const fallbackUri = uri.includes('mongodb+srv://')
      ? `mongodb://${user}:${pass}@${directHosts}/zap_shift_db?ssl=true&authSource=admin&retryWrites=true&w=majority`
      : `mongodb+srv://${user}:${pass}@cluster0.1zqbczf.mongodb.net/zap_shift_db?retryWrites=true&w=majority`;

    const fallbackClient = createClient(fallbackUri);
    await fallbackClient.connect();
    client = fallbackClient;
    db = fallbackClient.db('zap_shift_db');
    return db;
  }
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
  if (client) {
    await client.close();
  }
};

module.exports = {
  get client() {
    return getClient();
  },
  connectDB,
  getDB,
  collections,
  initIndexes,
  closeDB,
  ObjectId,
};
