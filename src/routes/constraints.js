const express = require('express');
const router = express.Router();
const constraintsController = require('../controllers/constraintsController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Get all constraints (public for system functionality)
router.get('/', constraintsController.getConstraints);

// Add or update constraint (admin only)
router.post('/', authenticate, requireAdmin, constraintsController.addConstraint);

// Delete constraint (admin only)
router.delete('/', authenticate, requireAdmin, constraintsController.deleteConstraint);

module.exports = router; 