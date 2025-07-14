const express = require('express');
const router = express.Router();
const knowledgeController = require('../controllers/knowledgeController');

// Get knowledge entries by company
router.get('/company/:companyId', knowledgeController.getKnowledgeByCompany);

// Search knowledge base
router.get('/search', knowledgeController.searchKnowledge);

// Create knowledge entry
router.post('/', knowledgeController.createKnowledge);

// Update knowledge entry
router.put('/:id', knowledgeController.updateKnowledge);

// Delete knowledge entry
router.delete('/:id', knowledgeController.deleteKnowledge);

module.exports = router; 