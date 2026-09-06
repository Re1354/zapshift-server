require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const apiLimiter = require('./middlewares/rateLimiter');
const routes = require('./routes');

const app = express();
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
app.use(apiLimiter);

// ======================================================
// Root Route
// ======================================================

app.get('/', (req, res) => {
  res.send('Zap Shift Server is Running!');
});

// ======================================================
// API Routes
// ======================================================

app.use(routes);

module.exports = app;
