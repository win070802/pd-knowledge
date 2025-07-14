const express = require('express');
const router = express.Router();
const constraintsController = require('../controllers/constraintsController');

// Get all constraints
router.get('/', constraintsController.getConstraints);

// Add or update constraint
router.post('/', constraintsController.addConstraint);

// Delete constraint
router.delete('/', constraintsController.deleteConstraint);

module.exports = router; 