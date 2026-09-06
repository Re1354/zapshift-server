const express = require('express');
const router = express.Router();

const userController = require('./user.controller');
const verifyFireBaseToken = require('../../middlewares/verifyFirebaseToken');
const verifyAdmin = require('../../middlewares/verifyAdmin');

// GET ALL USERS — ADMIN ONLY
router.get('/', verifyFireBaseToken, verifyAdmin, userController.getAllUsers);

// GET CURRENT USER ROLE — AUTHENTICATED
router.get('/role', verifyFireBaseToken, userController.getUserRole);

// GET SINGLE USER — ADMIN ONLY
router.get('/:id', verifyFireBaseToken, verifyAdmin, userController.getUserById);

// CREATE USER — AUTHENTICATED
router.post('/', verifyFireBaseToken, userController.createUser);

// UPDATE USER ROLE — ADMIN ONLY
router.patch('/:id/role', verifyFireBaseToken, verifyAdmin, userController.updateUserRole);

module.exports = router;
