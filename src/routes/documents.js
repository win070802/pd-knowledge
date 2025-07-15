const express = require('express');
const router = express.Router();
const { upload } = require('../config/multer');
const documentsController = require('../controllers/documentsController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Get all documents (public)
router.get('/', documentsController.getDocuments);

// Get document by ID (public)
router.get('/:id', documentsController.getDocumentById);

// Delete document (admin only)
router.delete('/:id', authenticate, requireAdmin, documentsController.deleteDocument);

// Reprocess document with AI text correction (admin only)
router.post('/:id/reprocess', authenticate, requireAdmin, documentsController.reprocessDocument);

module.exports = router; 