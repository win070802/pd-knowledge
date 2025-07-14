const express = require('express');
const router = express.Router();
const { upload } = require('../config/multer');

// Import route modules
const documentsRoutes = require('./documents');
const qaRoutes = require('./qa');
const constraintsRoutes = require('./constraints');
const companiesRoutes = require('./companies');
const sensitiveRulesRoutes = require('./sensitiveRules');
const knowledgeRoutes = require('./knowledge');
const debugRoutes = require('./debug');

// Import controllers for standalone endpoints
const documentsController = require('../controllers/documentsController');

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Standalone API endpoints
router.post('/api/upload', upload.single('document'), documentsController.uploadDocument);
router.get('/api/search', documentsController.searchDocuments);

// Apply routes with proper prefixes
router.use('/api/documents', documentsRoutes);
router.use('/api', qaRoutes);
router.use('/api/constraints', constraintsRoutes);
router.use('/api/companies', companiesRoutes);
router.use('/api/sensitive-rules', sensitiveRulesRoutes);
router.use('/api/knowledge', knowledgeRoutes);
router.use('/api/debug', debugRoutes);

module.exports = router; 