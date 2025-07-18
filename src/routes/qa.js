const express = require('express');
const router = express.Router();
const qaController = require('../controllers/qaController');
const ConversationService = require('../services/conversation/conversationService');

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

// Lấy context của session
router.get('/session/:sessionId/context', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }
    
    const conversationService = new ConversationService();
    const context = await conversationService.getSessionContext(sessionId);
    
    res.json({
      success: true,
      sessionId,
      context
    });
  } catch (error) {
    console.error('Error getting session context:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router; 
