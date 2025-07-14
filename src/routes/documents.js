const express = require('express');
const router = express.Router();
const { upload } = require('../config/multer');
const documentsController = require('../controllers/documentsController');

// Get all documents
router.get('/', documentsController.getDocuments);

// Get document by ID
router.get('/:id', documentsController.getDocumentById);

// Delete document
router.delete('/:id', documentsController.deleteDocument);

// Reprocess document with AI text correction
router.post('/:id/reprocess', documentsController.reprocessDocument);

module.exports = router; 