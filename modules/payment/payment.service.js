const { collections, ObjectId } = require('../../config/db');
const stripe = require('../../config/stripe');
const generateTrackingId = require('../../utils/generateTrackingId');
const logTracking = require('../../utils/logTracking');

const createCheckoutSession = async (parcelId, decodedEmail) => {
  const parcel = await collections.parcelsCollection.findOne({
    _id: new ObjectId(parcelId),
  });

  if (!parcel) {
    return { notFound: true };
  }

  if (parcel.userEmail !== decodedEmail) {
    return { forbidden: true };
  }

  if (parcel.paymentStatus === 'paid') {
    return { alreadyPaid: true };
  }

  const numericCost = Number(parcel.cost);

  if (!Number.isFinite(numericCost) || numericCost <= 0) {
    return { invalidCost: true };
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
    customer_email: decodedEmail,
    success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
  });

  return { sessionUrl: session.url };
};

const verifyPaymentSuccess = async (sessionId, decodedEmail) => {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== 'paid') {
    return { paymentNotCompleted: true };
  }

  const parcelId = session.metadata?.parcelId;

  if (!parcelId || !ObjectId.isValid(parcelId)) {
    return { invalidMetadata: true };
  }

  const parcel = await collections.parcelsCollection.findOne({
    _id: new ObjectId(parcelId),
  });

  if (!parcel) {
    return { notFound: true };
  }

  const stripeEmail =
    session.customer_details?.email || session.customer_email;

  if (
    stripeEmail &&
    stripeEmail.toLowerCase() !== decodedEmail.toLowerCase()
  ) {
    return { forbidden: true };
  }

  if (parcel.userEmail !== decodedEmail) {
    return { forbidden: true };
  }

  // Already paid — return existing data
  if (parcel.paymentStatus === 'paid') {
    const existingPayment = session.payment_intent
      ? await collections.paymentCollection.findOne({
          transactionId: session.payment_intent,
        })
      : null;

    return {
      alreadyPaid: true,
      trackingId: parcel.trackingId || null,
      paymentInfo: existingPayment || null,
    };
  }

  const trackingId = parcel.trackingId || generateTrackingId();

  const modifyParcel = await collections.parcelsCollection.updateOne(
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
    const existingPayment = await collections.paymentCollection.findOne({
      transactionId,
    });

    if (existingPayment) {
      paymentInfo = existingPayment;
    } else {
      const payment = {
        amount: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency || 'usd',
        customerEmail: decodedEmail,
        parcelId,
        parcelName: parcel.parcelName || '',
        transactionId,
        paymentStatus: session.payment_status,
        paidAt: new Date(),
        trackingId,
      };

      try {
        const paymentResult = await collections.paymentCollection.insertOne(payment);

        // Log tracking with parcelId
        await logTracking(trackingId, parcelId, 'pending-pickup');

        paymentInfo = { insertedId: paymentResult.insertedId };
      } catch (err) {
        if (err.code === 11000) {
          paymentInfo = await collections.paymentCollection.findOne({
            transactionId,
          });
        } else {
          throw err;
        }
      }
    }
  }

  return {
    success: true,
    modifyParcel,
    paymentInfo,
    trackingId,
  };
};

const getPaymentHistory = async (email) => {
  return await collections.paymentCollection
    .find({ customerEmail: email })
    .sort({ paidAt: -1 })
    .toArray();
};

module.exports = {
  createCheckoutSession,
  verifyPaymentSuccess,
  getPaymentHistory,
};
