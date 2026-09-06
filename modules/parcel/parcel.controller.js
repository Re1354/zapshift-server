const { ObjectId } = require('../../config/db');
const parcelService = require('./parcel.service');

const getDeliveryStatusStats = async (req, res) => {
  try {
    const result = await parcelService.getDeliveryStatusStats();
    res.send(result);
  } catch (error) {
    console.error('Get delivery status stats error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to fetch delivery status stats.' });
  }
};

const getParcels = async (req, res) => {
  try {
    const email = req.decoded_email;
    const { deliveryStatus } = req.query;

    const result = await parcelService.getParcels(email, deliveryStatus);

    if (result.userNotFound) {
      return res
        .status(404)
        .send({ success: false, message: 'User not found.' });
    }

    res.send(result.parcels);
  } catch (error) {
    console.error('Get parcels error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to fetch parcels.' });
  }
};

const getRiderParcels = async (req, res) => {
  try {
    const riderEmail = req.decoded_email;
    const { deliveryStatus } = req.query;

    const result = await parcelService.getRiderParcels(riderEmail, deliveryStatus);
    res.send(result);
  } catch (error) {
    console.error('Get rider parcels error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to get rider parcels.' });
  }
};

const updateDeliveryStatus = async (req, res) => {
  try {
    const { deliveryStatus } = req.body;
    const id = req.params.id;
    const riderEmail = req.decoded_email;

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .send({ success: false, message: 'Invalid parcel ID.' });
    }

    const result = await parcelService.updateDeliveryStatus(id, riderEmail, deliveryStatus);

    if (result.invalidStatus) {
      return res
        .status(400)
        .send({ success: false, message: 'Invalid delivery status.' });
    }

    if (result.notFound) {
      return res
        .status(404)
        .send({ success: false, message: 'Parcel not found.' });
    }

    if (result.invalidTransition) {
      return res.status(400).send({
        success: false,
        message: `Cannot change status from "${result.currentStatus}" to "${result.deliveryStatus}".`,
      });
    }

    if (result.alreadyChanged) {
      return res.status(404).send({
        success: false,
        message: 'Parcel status has already changed.',
      });
    }

    res.send({
      success: true,
      message: result.message,
      modifiedCount: result.modifiedCount,
      deliveryStatus: result.deliveryStatus,
    });
  } catch (error) {
    console.error('Update delivery status error:', error.message);
    res.status(500).send({
      success: false,
      message: 'Failed to update delivery status.',
    });
  }
};

const assignRider = async (req, res) => {
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

    const result = await parcelService.assignRider(id, { riderId, riderName, riderEmail });

    if (result.notFound) {
      return res
        .status(404)
        .send({ success: false, message: 'Parcel not found.' });
    }

    res.send({
      success: true,
      message: 'Rider assigned successfully.',
      parcelModifiedCount: result.parcelModifiedCount,
      riderModifiedCount: result.riderModifiedCount,
    });
  } catch (error) {
    console.error('Assign rider error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to assign rider.' });
  }
};

const getParcelById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .send({ success: false, message: 'Invalid parcel ID.' });
    }

    const result = await parcelService.getParcelById(id, req.decoded_email);

    if (result.notFound) {
      return res
        .status(404)
        .send({ success: false, message: 'Parcel not found.' });
    }

    if (result.forbidden) {
      return res
        .status(403)
        .send({ success: false, message: 'Forbidden access.' });
    }

    res.send(result.parcel);
  } catch (error) {
    console.error('Get single parcel error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to fetch parcel.' });
  }
};

const createParcel = async (req, res) => {
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

    const result = await parcelService.createParcel(body, email);
    res.status(201).send({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error('Create parcel error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to create parcel.' });
  }
};

const deleteParcel = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .send({ success: false, message: 'Invalid parcel ID.' });
    }

    const result = await parcelService.deleteParcel(id, req.decoded_email);

    if (result.notFound) {
      return res
        .status(404)
        .send({ success: false, message: 'Parcel not found.' });
    }

    if (result.forbidden) {
      return res
        .status(403)
        .send({ success: false, message: 'Forbidden access.' });
    }

    if (result.paid) {
      return res.status(400).send({
        success: false,
        message: 'Paid parcels cannot be deleted.',
      });
    }

    res.send({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Delete parcel error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to delete parcel.' });
  }
};

module.exports = {
  getDeliveryStatusStats,
  getParcels,
  getRiderParcels,
  updateDeliveryStatus,
  assignRider,
  getParcelById,
  createParcel,
  deleteParcel,
};
