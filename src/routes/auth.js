const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);

// Protected routes (require authentication)
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);
router.get('/verify', authenticate, authController.verifyToken);

// Admin only routes
router.post('/users', authenticate, requireAdmin, authController.createUser);
router.get('/users', authenticate, requireAdmin, authController.getUsers);
router.delete('/users/:id', authenticate, requireAdmin, authController.deactivateUser);

module.exports = router; 