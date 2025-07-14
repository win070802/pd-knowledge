const express = require('express');
const router = express.Router();
const sensitiveRulesController = require('../controllers/sensitiveRulesController');

// Get all sensitive rules
router.get('/', sensitiveRulesController.getSensitiveRules);

// Create sensitive rule
router.post('/', sensitiveRulesController.createSensitiveRule);

// Update sensitive rule
router.put('/:id', sensitiveRulesController.updateSensitiveRule);

// Delete sensitive rule
router.delete('/:id', sensitiveRulesController.deleteSensitiveRule);

module.exports = router; 