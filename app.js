require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const apiLimiter = require('./middlewares/rateLimiter');
const routes = require('./routes');

const app = express();
app.set('trust proxy', 1); // Trust first proxy for Vercel

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://zapshift-client.vercel.app',
  process.env.CLIENT_URL,
].filter(Boolean);

// ======================================================
// Security Middleware
// ======================================================

app.use(helmet());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

app.use(express.json({ limit: '100kb' }));
app.use(apiLimiter);

// ======================================================
// Root Route
// ======================================================

app.get('/', (req, res) => {
  res.send('Zap Shift Server is Running!');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      has_DB_USER: !!process.env.DB_USER,
      has_DB_PASS: !!process.env.DB_PASS,
      has_FB_SERVICE_KEY: !!process.env.FB_SERVICE_KEY,
      has_STRIPE_PAYMENT_SECRET: !!process.env.STRIPE_PAYMENT_SECRET,
      client_url: process.env.CLIENT_URL || 'default: http://localhost:5173',
      is_vercel: !!process.env.VERCEL,
    },
  });
});

// ======================================================
// API Routes
// ======================================================

// Ensure DB connection for serverless invocations
const { connectDB } = require('./config/db');
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
  next();
});

app.use(routes);

module.exports = app;
