const { ObjectId } = require('../../config/db');
const userService = require('./user.service');

const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      50,
    );
    const search = (req.query.search || '').trim();

    const data = await userService.getUsers({ page, limit, search });
    res.send(data);
  } catch (error) {
    console.error('Get users error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to fetch users.' });
  }
};

const getUserRole = async (req, res) => {
  try {
    const email = req.decoded_email;
    const user = await userService.getUserByEmail(email);
    res.send({ role: user?.role || 'user' });
  } catch (error) {
    console.error('Get user role error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to get user role.' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .send({ success: false, message: 'Invalid user ID.' });
    }

    const user = await userService.getUserById(id);

    if (!user) {
      return res
        .status(404)
        .send({ success: false, message: 'User not found.' });
    }

    res.send(user);
  } catch (error) {
    console.error('Get single user error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to fetch user.' });
  }
};

const createUser = async (req, res) => {
  try {
    const body = req.body;
    const email = req.decoded_email;

    const result = await userService.createUser({
      email,
      displayName: body.displayName,
      photoURL: body.photoURL,
    });

    if (result.alreadyExists) {
      return res.send({ success: true, message: 'User already exists.' });
    }

    res.status(201).send({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error('Create user error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to create user.' });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!ObjectId.isValid(id)) {
      return res
        .status(400)
        .send({ success: false, message: 'Invalid user ID.' });
    }

    if (!['admin', 'user'].includes(role)) {
      return res
        .status(400)
        .send({ success: false, message: 'Invalid role.' });
    }

    const result = await userService.updateUserRole(id, role, req.decoded_email);

    if (result.notFound) {
      return res
        .status(404)
        .send({ success: false, message: 'User not found.' });
    }

    if (result.cannotDemoteSelf) {
      return res.status(400).send({
        success: false,
        message: 'You cannot remove your own admin role.',
      });
    }

    res.send({
      success: true,
      message:
        role === 'admin'
          ? 'User has been promoted to admin successfully.'
          : 'Admin role has been removed successfully.',
      result: result.result,
    });
  } catch (error) {
    console.error('Update user role error:', error.message);
    res
      .status(500)
      .send({ success: false, message: 'Failed to update user role.' });
  }
};

module.exports = {
  getAllUsers,
  getUserRole,
  getUserById,
  createUser,
  updateUserRole,
};
