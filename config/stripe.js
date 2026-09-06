require('dotenv').config();
const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_PAYMENT_SECRET);

module.exports = stripe;
