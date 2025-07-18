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

// Main file upload (tạm thời bỏ xác thực để test)
router.post('/api/upload', upload.single('file'), documentsController.uploadDocument);

// Document categories (public)
router.get('/api/categories', documentsController.getCategories);

// Apply routes with proper prefixes
router.use('/api/documents', documentsRoutes);
router.use('/api/qa', qaRoutes);
router.use('/api/constraints', constraintsRoutes);
router.use('/api/companies', companiesRoutes);
router.use('/api/sensitive-rules', sensitiveRulesRoutes);
router.use('/api/knowledge', knowledgeRoutes);
router.use('/api/debug', authenticate, requireAdmin, debugRoutes);
router.use('/api/auth', authRoutes);

// Learn API routes (admin only)
router.post('/api/learn', authenticate, requireAdmin, learnController.learnFromText);
router.post('/api/learn/correct', authenticate, requireAdmin, (req, res, next) => {
  req.body.isCorrection = true; // Đánh dấu đây là yêu cầu sửa lỗi/cập nhật
  next();
}, learnController.learnFromText);
router.post('/api/learn/document-company', authenticate, requireAdmin, learnController.learnDocumentCompany);
router.get('/api/learn', learnController.getKnowledge);

module.exports = router; 