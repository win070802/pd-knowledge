const express = require('express');
const router = express.Router();
const { upload } = require('../config/multer');
const { authenticate, requireAdmin, optionalAuth } = require('../middleware/auth');

// Import route modules
const documentsRoutes = require('./documents');
const qaRoutes = require('./qa');
const constraintsRoutes = require('./constraints');
const companiesRoutes = require('./companies');
const sensitiveRulesRoutes = require('./sensitiveRules');
const knowledgeRoutes = require('./knowledge');
const debugRoutes = require('./debug');
const authRoutes = require('./auth');

// Import controllers for standalone endpoints
const documentsController = require('../controllers/documentsController');
const learnController = require('../controllers/learnController');

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Authentication routes
router.use('/api/auth', authRoutes);

// Standalone API endpoints (protected)
router.post('/api/upload', authenticate, requireAdmin, upload.single('document'), documentsController.uploadDocument);
router.get('/api/search', documentsController.searchDocuments);

// Apply routes with proper prefixes
router.use('/api/documents', documentsRoutes);
router.use('/api', qaRoutes);
router.use('/api/constraints', constraintsRoutes);
router.use('/api/companies', companiesRoutes);
router.use('/api/sensitive-rules', sensitiveRulesRoutes);
router.use('/api/knowledge', knowledgeRoutes);
router.use('/api/debug', debugRoutes);

// Learn API routes (admin only)
router.post('/api/learn', authenticate, requireAdmin, learnController.learnFromText);
router.post('/api/learn/document-company', authenticate, requireAdmin, learnController.learnDocumentCompany);
router.get('/api/learn', learnController.getKnowledge);

module.exports = router; 