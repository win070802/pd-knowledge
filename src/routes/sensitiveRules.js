const express = require('express');
const router = express.Router();
const sensitiveRulesController = require('../controllers/sensitiveRulesController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Get all sensitive rules (public for system functionality)
router.get('/', sensitiveRulesController.getSensitiveRules);

// Create sensitive rule (admin only)
router.post('/', authenticate, requireAdmin, sensitiveRulesController.createSensitiveRule);

// Update sensitive rule (admin only)
router.put('/:id', authenticate, requireAdmin, sensitiveRulesController.updateSensitiveRule);

// Delete sensitive rule (admin only)
router.delete('/:id', authenticate, requireAdmin, sensitiveRulesController.deleteSensitiveRule);

module.exports = router; 