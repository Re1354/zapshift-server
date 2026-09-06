const { ObjectId } = require('../../config/db');
const riderService = require('./rider.service');

const getDeliveryPerDay = async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).send({
        success: false,
        message: 'Rider email is required.',
      });
    }

    const result = await riderService.getDeliveryPerDay(email);
    res.send(result);
  } catch (error) {
    console.error('Delivery per day error:', error.message);
    res.status(500).send({
      success: false,
      message: 'Failed to get delivery data.',
    });
  }
};

const createRiderApplication = async (req, res) => {
  try {
    const body = req.body;
    const email = req.decoded_email;

    if (
      !body.name ||
      !body.licenseNumber ||
      !body.region ||
      !body.district ||
      !body.nid ||
      !body.phone ||
      !body.bikeModel ||
      !body.bikeRegistration ||
      !body.about
    ) {
      return res.status(400).send({
        success: false,
        message: 'All rider information is required.',
      });
    }

    const result = await riderService.createRiderApplication(body, email);

    if (result.alreadySubmitted) {
      return res.status(409).send({
        success: false,
        message: 'You have already submitted a rider application.',
      });
    }

    res.status(201).send({
      success: true,
      message: 'Rider application submitted successfully.',
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error('Create rider application error:', error.message);

    if (error.code === 11000) {
      return res.status(409).send({
        success: false,
        message: 'You have already submitted a rider application.',
      });
    }

    res.status(500).send({
      success: false,
      message: 'Failed to submit rider application.',
    });
  }
};

const getAllRiders = async (req, res) => {
  try {
    const { status, district, workStatus } = req.query;
    const riders = await riderService.getRiders({ status, district, workStatus });

    res.send({ success: true, riders });
  } catch (error) {
    console.error('Get riders error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to get riders.' });
  }
};

const updateRiderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!['approved', 'rejected'].includes(status)) {
      return res
        .status(400)
        .send({ success: false, message: 'Invalid rider status.' });
    }

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .send({ success: false, message: 'Invalid rider ID.' });
    }

    const result = await riderService.updateRiderStatus(id, status);

    if (result.notFound) {
      return res
        .status(404)
        .send({ success: false, message: 'Rider not found.' });
    }

    if (result.alreadyStatus) {
      return res.send({
        success: true,
        message: `Rider is already ${status}.`,
      });
    }

    res.send({
      success: true,
      message:
        status === 'approved'
          ? 'Rider approved and user role updated successfully.'
          : 'Rider application rejected successfully.',
      result: result.result,
    });
  } catch (error) {
    console.error('Update rider status error:', error.message);
    res.status(500).send({
      success: false,
      message: 'Failed to update rider status.',
    });
  }
};

module.exports = {
  getDeliveryPerDay,
  createRiderApplication,
  getAllRiders,
  updateRiderStatus,
};
