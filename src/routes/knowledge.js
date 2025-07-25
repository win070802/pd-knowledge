const express = require('express');
const router = express.Router();
const knowledgeController = require('../controllers/knowledgeController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Get knowledge entries by company (public)
router.get('/company/:companyId', knowledgeController.getKnowledgeByCompany);

// Search knowledge base (public)
router.get('/search', knowledgeController.searchKnowledge);

// Create knowledge entry (admin only)
router.post('/', authenticate, requireAdmin, knowledgeController.createKnowledge);

// Update knowledge entry (admin only)
router.put('/:id', authenticate, requireAdmin, knowledgeController.updateKnowledge);

// Delete knowledge entry (admin only)
router.delete('/:id', authenticate, requireAdmin, knowledgeController.deleteKnowledge);

module.exports = router; 