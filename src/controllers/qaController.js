const { db } = require('../../database');
const geminiService = require('../../gemini');

// Ask question
const askQuestion = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    const result = await geminiService.askQuestion(question.trim());

    res.json({
      success: true,
      question: question.trim(),
      answer: result.answer,
      relevantDocuments: result.relevantDocuments,
      responseTime: result.responseTime
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

module.exports = {
  askQuestion,
  getHistory,
  summarizeDocument,
  extractKeyInfo
}; 