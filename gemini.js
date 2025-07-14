const { db } = require('./database');
const ConstraintsService = require('./src/services/constraints/constraintsService');
const DocumentSearchService = require('./src/services/search/documentSearchService');
const ContentClassifier = require('./src/utils/content/contentClassifier');
const GeminiAiService = require('./src/services/ai/geminiAiService');

class GeminiService {
  constructor() {
    this.constraintsService = new ConstraintsService();
    this.searchService = new DocumentSearchService();
    this.contentClassifier = new ContentClassifier();
    this.aiService = new GeminiAiService();
  }

  // Delegate methods to appropriate services
  getConstraints() {
    return this.constraintsService.getConstraints();
  }

  addConstraint(question, answer) {
    return this.constraintsService.addConstraint(question, answer);
  }

  removeConstraint(question) {
    return this.constraintsService.removeConstraint(question);
  }

  // Main Q&A function
  async askQuestion(question) {
    const startTime = Date.now();
    
    try {
      console.log(`\n🔍 Processing question: "${question}"`);
      
      // Check for sensitive content first
      const isSensitive = await this.contentClassifier.isSensitiveContent(question);
      console.log(`🛡️ Sensitive content check: ${isSensitive}`);
      
      if (isSensitive) {
        console.log(`❌ Blocked sensitive content`);
        const answer = 'Xin lỗi, tôi không thể trả lời câu hỏi này vì nó có thể chứa nội dung không phù hợp. Tôi chỉ có thể hỗ trợ với các câu hỏi tích cực và có tính xây dựng. Vui lòng đặt câu hỏi khác.';
        const responseTime = Date.now() - startTime;
        
        await db.createQuestion({
          question,
          answer,
          documentIds: [],
          responseTime
        });
        
        return {
          answer,
          documentIds: [],
          relevantDocuments: [],
          responseTime
        };
      }

      // Check constraints first (highest priority)
      const constraintAnswer = this.constraintsService.checkConstraints(question);
      console.log(`🔒 Constraint check: ${constraintAnswer ? 'Found match' : 'No match'}`);
      
      if (constraintAnswer) {
        console.log(`✅ Using constraint answer`);
        const responseTime = Date.now() - startTime;
        
        await db.createQuestion({
          question,
          answer: constraintAnswer,
          documentIds: [],
          responseTime
        });
        
        return {
          answer: constraintAnswer,
          documentIds: [],
          relevantDocuments: [],
          responseTime
        };
      }

      // Check if it's a general question first
      const isGeneral = this.contentClassifier.isGeneralQuestion(question);
      console.log(`💬 General question check: ${isGeneral}`);
      
      if (isGeneral) {
        console.log(`✅ Handling as general greeting`);
        const answer = await this.contentClassifier.handleGeneralQuestion(question);
        const responseTime = Date.now() - startTime;
        
        await db.createQuestion({
          question,
          answer,
          documentIds: [],
          responseTime
        });
        
        return {
          answer,
          documentIds: [],
          relevantDocuments: [],
          responseTime
        };
      }
      
      // Check if it's a document-specific question
      const isDocumentSpecific = this.contentClassifier.isDocumentSpecificQuestion(question);
      console.log(`📄 Document-specific check: ${isDocumentSpecific}`);
      
      if (isDocumentSpecific) {
        console.log(`📋 Searching for relevant documents...`);
        const relevantDocs = await this.searchService.findRelevantDocuments(question);
        console.log(`📊 Found ${relevantDocs.length} relevant documents`);
        
        if (relevantDocs.length === 0) {
          console.log(`❌ No documents found, returning standard message`);
          const answer = 'Xin lỗi, tôi không tìm thấy tài liệu nào liên quan đến câu hỏi của bạn. Vui lòng:\n\n• Kiểm tra lại từ khóa\n• Upload thêm tài liệu liên quan\n• Thử đặt câu hỏi khác\n\nBạn có thể sử dụng chức năng tìm kiếm để xem các tài liệu hiện có trong hệ thống.';
          const responseTime = Date.now() - startTime;
          
          await db.createQuestion({
            question,
            answer,
            documentIds: [],
            responseTime
          });
          
          return {
            answer,
            documentIds: [],
            relevantDocuments: [],
            responseTime
          };
        }
        
        // Process with documents
        return await this.aiService.processWithDocuments(question, relevantDocs, startTime);
      }
      
      // For general questions, use Gemini without documents
      console.log(`🤖 Handling as general chatbot question`);
      const answer = await this.aiService.handleGeneralChatbotQuestion(question);
      const responseTime = Date.now() - startTime;
      console.log(`✅ Generated answer: ${answer.substring(0, 50)}...`);
      
      await db.createQuestion({
        question,
        answer,
        documentIds: [],
        responseTime
      });
      
      return {
        answer,
        documentIds: [],
        relevantDocuments: [],
        responseTime
      };
      
    } catch (error) {
      console.error('Error in askQuestion:', error);
      throw new Error('Có lỗi xảy ra khi xử lý câu hỏi. Vui lòng thử lại.');
    }
  }

  // Delegate document operations to AI service
  async summarizeDocument(documentId) {
    return this.aiService.summarizeDocument(documentId);
  }

  async extractKeyInfo(searchTerm) {
    return this.aiService.extractKeyInfo(searchTerm);
  }
}

module.exports = new GeminiService(); 