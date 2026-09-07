require('dotenv').config();
const Stripe = require('stripe');

let stripe = null;
const stripeKey = process.env.STRIPE_PAYMENT_SECRET
  ? process.env.STRIPE_PAYMENT_SECRET.trim().replace(/^["']|["']$/g, '')
  : null;

if (stripeKey) {
  try {
    stripe = Stripe(stripeKey);
  } catch (error) {
    console.error('Failed to initialize Stripe:', error.message);
  }
}

module.exports = stripe;

