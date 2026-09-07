require('dotenv').config();

const app = require('./app');
const { connectDB, initIndexes, closeDB } = require('./config/db');

const port = process.env.PORT || 3000;

// ======================================================
// Main Server
// ======================================================

async function run() {
  try {
    await connectDB();
    await initIndexes();

    // MongoDB Health Check
    // await client.db('admin').command({ ping: 1 });
    console.log('MongoDB connected successfully!');

    app.listen(port, () => {
      console.log(`Zap Shift server is running on port ${port}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error);
  }
}

// Only listen locally, Vercel manages requests via exported app
if (!process.env.VERCEL) {
  run();
}

// ======================================================
// Graceful Shutdown
// ======================================================

process.on('SIGINT', async () => {
  try {
    await closeDB();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
    process.exit(1);
  }
});

module.exports = app;
