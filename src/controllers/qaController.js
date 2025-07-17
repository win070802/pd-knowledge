const { db } = require('../../database');
const geminiService = require('../../services/gemini');
const ConversationService = require('../services/conversation/conversationService');
const QuestionAnalysisService = require('../services/ai/questionAnalysisService');
const DataIntegrationService = require('../services/ai/dataIntegrationService');
const ContentClassifier = require('../utils/content/contentClassifier');
const documentRepository = require('../repositories/documentRepository');

const conversationService = new ConversationService();
const questionAnalysisService = new QuestionAnalysisService();
const dataIntegrationService = new DataIntegrationService();
const contentClassifier = new ContentClassifier();

// Ask question with conversation context
const askQuestion = async (req, res) => {
  try {
    const { question, sessionId, userId } = req.body;
    const startTime = Date.now();

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

    // Kiểm tra nội dung nhạy cảm
    const isSensitive = await contentClassifier.isSensitiveContent(question);
    if (isSensitive) {
      const answer = `⚠️ Câu hỏi của bạn có thể chứa nội dung nhạy cảm hoặc không phù hợp với chính sách của hệ thống. Vui lòng đặt câu hỏi khác hoặc liên hệ quản trị viên nếu bạn cho rằng đây là lỗi.`;
      
      await conversationService.saveMessage(actualSessionId, 'answer', answer, [], { 
        isSensitive: true,
        originalQuestion: question.trim()
      });

      return res.json({
        success: true,
        sessionId: actualSessionId,
        question: question.trim(),
        answer,
        relevantDocuments: [],
        responseTime: Date.now() - startTime,
        contextInfo: {
          isSensitive: true
        }
      });
    }

    // Then resolve references (which needs the history)
    const referenceResolution = await conversationService.resolveReferences(actualSessionId, question.trim());
    
    if (referenceResolution.error) {
      // Return helpful error message for unresolved references
      const answer = `❓ ${referenceResolution.error}\n\n💡 *Hãy hỏi cụ thể tên tài liệu để tôi có thể trả lời chính xác.*`;
      
      await conversationService.saveMessage(actualSessionId, 'answer', answer, [], { 
        hasReferenceError: true,
        originalQuestion: question.trim(),
        referenceAnalysis: referenceResolution.analysis || {}
      });

      return res.json({
        success: true,
        sessionId: actualSessionId,
        question: question.trim(),
        answer,
        relevantDocuments: [],
        responseTime: Date.now() - startTime,
        contextInfo: {
          hasReference: referenceResolution.hasReference,
          resolved: false,
          error: referenceResolution.error,
          referenceAnalysis: referenceResolution.analysis || {}
        }
      });
    }

    // Use resolved question for processing
    const processQuestion = referenceResolution.resolvedQuestion;
    console.log(`🔗 Using question: "${processQuestion}"`);
    
    // Ghi log thông tin phân tích tham chiếu nếu có
    if (referenceResolution.hasReference && referenceResolution.analysis) {
      console.log(`🔍 Phân tích tham chiếu:`);
      console.log(`   - Loại tham chiếu: ${referenceResolution.analysis.referenceType || 'N/A'}`);
      console.log(`   - Độ tin cậy: ${referenceResolution.analysis.confidence || 0}%`);
      console.log(`   - Giải thích: ${referenceResolution.analysis.explanation || 'N/A'}`);
    }

    // Phân tích câu hỏi để xác định intent, chủ đề và nguồn dữ liệu
    const questionAnalysis = await questionAnalysisService.analyzeQuestion(processQuestion, actualSessionId);
    console.log(`📊 Question analysis:`, JSON.stringify(questionAnalysis));
    
    // Xử lý nếu phát hiện nội dung nhạy cảm từ phân tích
    if (questionAnalysis.intent === 'sensitive_content') {
      const answer = `⚠️ Câu hỏi của bạn có thể chứa nội dung nhạy cảm hoặc không phù hợp với chính sách của hệ thống. Vui lòng đặt câu hỏi khác hoặc liên hệ quản trị viên nếu bạn cho rằng đây là lỗi.`;
      
      await conversationService.saveMessage(actualSessionId, 'answer', answer, [], { 
        isSensitive: true,
        originalQuestion: question.trim()
      });

      return res.json({
        success: true,
        sessionId: actualSessionId,
        question: question.trim(),
        answer,
        relevantDocuments: [],
        responseTime: Date.now() - startTime,
        contextInfo: {
          isSensitive: true
        }
      });
    }
    
    // Hợp nhất dữ liệu từ nhiều nguồn
    const integratedData = await dataIntegrationService.integrateData(processQuestion, questionAnalysis);

    // Nếu là intent list_documents, lưu danh sách documentId vào session context
    if (questionAnalysis.intent === 'list_documents' && integratedData.documents && integratedData.documents.length > 0) {
      // Lưu mảng id tài liệu vào context
      const documentIdList = integratedData.documents.map(doc => doc.id);
      await conversationService.updateSessionContext(actualSessionId, { lastDocumentList: documentIdList });
    }
    
    // Xử lý câu hỏi với dữ liệu đã hợp nhất
    let result;
    
    // Nếu có constraint phù hợp, sử dụng nó
    if (integratedData.constraint) {
      result = {
        answer: integratedData.constraint.answer,
        relevantDocuments: [],
        responseTime: Date.now() - startTime
      };
    }
    // Nếu không có constraint, xử lý theo nguồn dữ liệu
    else {
      // Ưu tiên sử dụng geminiService.askQuestion nếu có tài liệu hoặc knowledge entries
      if (integratedData.documents.length > 0 || integratedData.knowledgeEntries.length > 0) {
        result = await geminiService.askQuestion(processQuestion, {
          documents: integratedData.documents,
          knowledgeEntries: integratedData.knowledgeEntries,
          companyInfo: integratedData.companyInfo,
          departmentInfo: integratedData.departmentInfo,
          analysisResult: questionAnalysis
        });
      }
      // Nếu không có dữ liệu, xử lý như câu hỏi chung
      else {
        result = await geminiService.askQuestion(processQuestion);
      }
    }

    // Bổ sung metadata về phân tích câu hỏi vào kết quả
    result.analysisResult = questionAnalysis;
    
    // Lưu thông tin về nguồn dữ liệu đã sử dụng
    const metadata = {
      responseTime: result.responseTime || (Date.now() - startTime),
      originalQuestion: question.trim(),
      resolvedQuestion: processQuestion,
      hasReference: referenceResolution.hasReference,
      analysisResult: questionAnalysis,
      dataSources: integratedData.metadata?.sources || [],
      referenceAnalysis: referenceResolution.analysis || {}
    };

    // Save the answer to conversation history
    await conversationService.saveMessage(
      actualSessionId, 
      'answer', 
      result.answer, 
      result.relevantDocuments || [],
      metadata
    );

    // Nếu là intent document_by_index và có documentId, trả về chi tiết tài liệu
    if (questionAnalysis.intent === 'document_by_index' && questionAnalysis.documentId) {
      // Lấy chi tiết tài liệu từ DB
      const docDetail = await documentRepository.getDocumentById(questionAnalysis.documentId);
      if (docDetail) {
        const answer = `Chi tiết tài liệu số ${questionAnalysis.index + 1}:
- Tên: ${docDetail.original_name}
- Loại: ${docDetail.category}
- Dung lượng: ${docDetail.file_size} bytes
- Số trang: ${docDetail.page_count || 'N/A'}
- Mô tả: ${docDetail.metadata && docDetail.metadata.description ? docDetail.metadata.description : 'Không có mô tả.'}`;
        await conversationService.saveMessage(actualSessionId, 'answer', answer, [docDetail], { byIndex: true, documentId: docDetail.id });
        return res.json({
          success: true,
          sessionId: actualSessionId,
          question: question.trim(),
          answer,
          relevantDocuments: [docDetail],
          responseTime: Date.now() - startTime,
          contextInfo: {
            byIndex: true,
            documentId: docDetail.id,
            index: questionAnalysis.index
          }
        });
      } else {
        const answer = `Không tìm thấy tài liệu theo thứ tự yêu cầu trong danh sách trước đó.`;
        await conversationService.saveMessage(actualSessionId, 'answer', answer, [], { byIndex: true, error: 'Not found' });
        return res.json({
          success: false,
          sessionId: actualSessionId,
          question: question.trim(),
          answer,
          relevantDocuments: [],
          responseTime: Date.now() - startTime,
          contextInfo: {
            byIndex: true,
            error: 'Not found',
            index: questionAnalysis.index
          }
        });
      }
    }

    res.json({
      success: true,
      sessionId: actualSessionId,
      question: question.trim(),
      answer: result.answer,
      relevantDocuments: result.relevantDocuments || [],
      responseTime: result.responseTime || (Date.now() - startTime),
      contextInfo: {
        hasReference: referenceResolution.hasReference,
        resolved: referenceResolution.hasReference,
        resolvedQuestion: referenceResolution.hasReference ? processQuestion : undefined,
        referencedDocuments: referenceResolution.referencedDocuments || [],
        analysisResult: questionAnalysis,
        dataSources: integratedData.metadata?.sources || [],
        referenceAnalysis: referenceResolution.analysis || {}
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