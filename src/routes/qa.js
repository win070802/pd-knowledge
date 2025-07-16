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

// Conversation management
router.get('/conversation/:sessionId/history', qaController.getConversationHistory);
router.get('/conversation/:sessionId/stats', qaController.getConversationStats);
router.delete('/conversation/:sessionId', qaController.endConversation);

module.exports = router; 
