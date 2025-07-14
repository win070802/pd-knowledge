const express = require('express');
const router = express.Router();
const qaController = require('../controllers/qaController');

// Ask question
router.post('/ask', qaController.askQuestion);

// Get Q&A history
router.get('/history', qaController.getHistory);

// Summarize document
router.post('/summarize/:id', qaController.summarizeDocument);

// Extract key information
router.post('/extract', qaController.extractKeyInfo);

module.exports = router; 