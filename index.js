const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_PAYMENT_SECRET);

require('dotenv').config();

const app = express();

const port = process.env.PORT || 3000;

// Middleware

app.use(cors());

app.use(express.json());

// MongoDB

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.1zqbczf.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Routes

app.get('/', (req, res) => {
  res.send('Zap Shift Server is Running!');
});

//Start Server

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();

    const db = client.db('zap_shift_db');

    const parcelsCollection = db.collection('parcels');

    //parcel api

    app.get('/parcels', async (req, res) => {
      const query = {};

      const { email } = req.query;

      if (email) {
        query.senderEmail = email;
      }

      const cursor = parcelsCollection.find(query).sort({ createdAt: -1 });

      const result = await cursor.toArray();

      res.send(result);
    });

    app.post('/parcels', async (req, res) => {
      const parcel = req.body;

      const parcelData = {
        ...parcel,
        createdAt: new Date(),
      };

      const result = await parcelsCollection.insertOne(parcelData);

      res.send(result);
    });

    app.delete('/parcels/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelsCollection.deleteOne(query);
      res.send(result);
    });

    app.get('/parcels/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelsCollection.findOne(query);
      res.send(result);
    });

    //Payment related api
    app.post('/create-checkout-session', async (req, res) => {
      const paymentInfo = req.body;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency: 'USD',
              unit_amount: 1500,
              product_data: {
                name: paymentInfo.parcelName,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInffo.senderEmail,
        mode: 'payment',
        metadata: {
          parcelId: paymentInfo.parcelId,
        },
        success_url: `${SITE_DOMAIN}/dashboard/payment-success`,
        // Provide a name (for example, hosted_web_0001) to label this Checkout integration and measure its conversion independently
        integration_identifier: '{{INTEGRATION_ID}}',
      });

      res.redirect(303, session.url);
    });

    // Test MongoDB connection

    await client.db('admin').command({ ping: 1 });

    console.log('MongoDB connected successfully!');

    // Start Express server

    app.listen(port, () => {
      console.log(`Zap Shift server is running on port ${port}`);
    });
  } catch (error) {
    console.error('MongoDB connection failed:', error);
  }
}

run();

// Graceful Shutdown

process.on('SIGINT', async () => {
  await client.close();

  console.log('MongoDB connection closed.');

  process.exit(0);
});
