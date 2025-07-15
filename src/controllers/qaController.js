const { db } = require('../../database');
const geminiService = require('../../services/gemini');
const ConversationService = require('../services/conversation/conversationService');

const conversationService = new ConversationService();

// Ask question with conversation context
const askQuestion = async (req, res) => {
  try {
    const { question, sessionId, userId } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    console.log(`🗣️ Processing question with session: ${sessionId || 'new'}`);

    // Get or create conversation session
    const session = await conversationService.getOrCreateSession(sessionId, userId);
    const actualSessionId = session.session_id;

    // Save the question to conversation history FIRST
    const savedQuestion = await conversationService.saveMessage(actualSessionId, 'question', question.trim());
    if (!savedQuestion) {
      throw new Error(`Failed to save question to session ${actualSessionId}`);
    }

    // Then resolve references (which needs the history)
    const referenceResolution = await conversationService.resolveReferences(actualSessionId, question.trim());
    
    if (referenceResolution.error) {
      // Return helpful error message for unresolved references
      const answer = `❓ ${referenceResolution.error}\n\n💡 *Hãy hỏi cụ thể tên tài liệu để tôi có thể trả lời chính xác.*`;
      
      await conversationService.saveMessage(actualSessionId, 'answer', answer, [], { 
        hasReferenceError: true,
        originalQuestion: question.trim()
      });

      return res.json({
        success: true,
        sessionId: actualSessionId,
        question: question.trim(),
        answer,
        relevantDocuments: [],
        responseTime: 50,
        contextInfo: {
          hasReference: referenceResolution.hasReference,
          resolved: false,
          error: referenceResolution.error
        }
      });
    }

    // Use resolved question for processing
    const processQuestion = referenceResolution.resolvedQuestion;
    console.log(`🔗 Using question: "${processQuestion}"`);

    const result = await geminiService.askQuestion(processQuestion);

    // Save the answer to conversation history
    await conversationService.saveMessage(
      actualSessionId, 
      'answer', 
      result.answer, 
      result.relevantDocuments,
      { 
        responseTime: result.responseTime,
        originalQuestion: question.trim(),
        resolvedQuestion: processQuestion,
        hasReference: referenceResolution.hasReference
      }
    );

    res.json({
      success: true,
      sessionId: actualSessionId,
      question: question.trim(),
      answer: result.answer,
      relevantDocuments: result.relevantDocuments,
      responseTime: result.responseTime,
      contextInfo: {
        hasReference: referenceResolution.hasReference,
        resolved: referenceResolution.hasReference,
        resolvedQuestion: referenceResolution.hasReference ? processQuestion : undefined,
        referencedDocuments: referenceResolution.referencedDocuments || []
      }
    });

  } catch (error) {
    console.error('Error processing question:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get Q&A history
const getHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const questions = await db.getQuestions(limit);
    res.json({ success: true, questions });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Summarize document
const summarizeDocument = async (req, res) => {
  try {
    const documentId = req.params.id;
    const result = await geminiService.summarizeDocument(documentId);
    res.json({ success: true, summary: result });
  } catch (error) {
    console.error('Error summarizing document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Extract key information
const extractKeyInfo = async (req, res) => {
  try {
    const { searchTerm } = req.body;
    
    if (!searchTerm || searchTerm.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Search term is required' });
    }

    const result = await geminiService.extractKeyInfo(searchTerm.trim());
    res.json({ success: true, result });

  } catch (error) {
    console.error('Error extracting key info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get conversation history
const getConversationHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit } = req.query;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }

    const history = await conversationService.getConversationHistory(sessionId, parseInt(limit) || 10);
    const context = await conversationService.getSessionContext(sessionId);

    res.json({
      success: true,
      sessionId,
      history,
      context,
      totalMessages: history.length
    });

  } catch (error) {
    console.error('Error getting conversation history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get conversation statistics
const getConversationStats = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }

    const stats = await conversationService.getConversationStats(sessionId);

    if (!stats) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting conversation stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// End conversation session
const endConversation = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Session ID is required' });
    }

    await conversationService.expireSession(sessionId);

    res.json({
      success: true,
      message: 'Conversation ended successfully',
      sessionId
    });

  } catch (error) {
    console.error('Error ending conversation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  askQuestion,
  getHistory,
  summarizeDocument,
  extractKeyInfo,
  getConversationHistory,
  getConversationStats,
  endConversation
}; 