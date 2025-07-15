const { db } = require('../database');
const ConstraintsService = require('../src/services/constraints/constraintsService');
const DocumentSearchService = require('../src/services/search/documentSearchService');
const ContentClassifier = require('../src/utils/content/contentClassifier');
const GeminiAiService = require('../src/services/ai/geminiAiService');

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

  // Check if question is about company-specific information  
  isCompanyRelatedQuestion(question) {
    const questionLower = question.toLowerCase();
    
    // Company codes in question
    const companies = ['pdh', 'pdi', 'pde', 'pdhh', 'rh'];
    const hasCompanyCode = companies.some(company => questionLower.includes(company));
    
    if (hasCompanyCode) {
      console.log(`🏢 Company code detected in question: ${question}`);
      return true;
    }
    
    // Company-related keywords (more comprehensive)
    const companyKeywords = [
      // Leadership and roles
      'cio', 'ceo', 'cfo', 'cto', 'giám đốc', 'chủ tịch', 'trưởng phòng', 'trưởng bộ phận',
      'ai là', 'là ai', 'chức vụ', 'vị trí', 'lãnh đạo', 'quản lý',
      'director', 'manager', 'head of', 'chief', 'officer',
      // Team and organizational (expanded)
      'team', 'ban', 'phòng', 'bộ phận', 'department', 'division', 'đội', 'nhóm',
      'nhân viên', 'bao nhiêu người', 'mấy người', 'số lượng', 'có ai', 'gồm có', 'những ai',
      'thành viên', 'staff', 'member', 'employee', 'danh sách',
      // IT and technical terms
      'it', 'công nghệ thông tin', 'cntt', 'technology', 'phần mềm', 'hạ tầng',
      // Business information
      'doanh thu', 'tài chính', 'lợi nhuận', 'chi phí', 'revenue', 'profit',
      'công ty', 'tập đoàn', 'doanh nghiệp', 'company', 'corporation',
      // Policies and processes  
      'nghỉ phép', 'ngày phép', 'chính sách', 'quy định', 'quy trình',
      'vacation', 'leave', 'policy', 'process', 'procedure'
    ];
    
    const hasCompanyKeywords = companyKeywords.some(keyword => questionLower.includes(keyword));
    
    if (hasCompanyKeywords) {
      console.log(`🏢 Company keywords detected in question: ${question}`);
      return true;
    }
    
    console.log(`❌ No company relation detected in question: ${question}`);
    return false;
  }

  // Check if question should prioritize knowledge base over constraints  
  isKnowledgePriorityQuestion(question) {
    // First check if it's company-related
    if (this.isCompanyRelatedQuestion(question)) {
      console.log(`🏢 Company-related question detected, prioritizing knowledge base`);
      return true;
    }
    
    const questionLower = question.toLowerCase();
    
    // Additional specific policy questions where knowledge base should have priority
    const specificPolicyKeywords = [
      'nghỉ phép', 'ngày phép', 'vacation', 'leave', 'days off',
      'chính sách nghỉ', 'quy định nghỉ', 'nghỉ bao nhiêu',
      'buổi nghỉ', 'tháng nghỉ', 'năm nghỉ',
      'policy nghỉ', 'leave policy', 'vacation policy'
    ];
    
    // Keywords for listing regulations/processes (should search documents)
    const documentListKeywords = [
      'các quy định', 'các quy trình', 'quy định quy trình',
      'danh sách quy định', 'danh sách quy trình',
      'regulations list', 'process list', 'policies list',
      'quy định hiện tại', 'quy trình hiện tại',
      'có những quy định', 'có những quy trình'
    ];
    
    // Company-specific policy patterns
    const companyPolicyPatterns = [
      /\w+\s+(nghỉ|phép|vacation|leave)/,  // "PDH nghỉ", "company vacation"
      /(nghỉ|phép|vacation|leave)\s+của\s+\w+/, // "nghỉ của PDH"
      /(quy định|chính sách|policy)\s+(nghỉ|phép|vacation|leave)/, // "quy định nghỉ phép"
      /(theo\s+quy\s+định|according\s+to\s+policy).*\s+(nghỉ|phép|vacation|leave)/, // "theo quy định... nghỉ phép"
      // Leadership and organizational patterns
      /(ai\s+là|who\s+is).*(cio|ceo|cfo|cto|giám\s+đốc|director|manager|chief)/i, // "Ai là CIO"
      /(cio|ceo|cfo|cto|giám\s+đốc|director|manager|chief).*(của|at|in)\s+\w+/i, // "CIO của PDH"
      /\w+\s+(có|has).*(cio|ceo|cfo|cto|giám\s+đốc|director|manager|chief)/i, // "PDH có CIO"
      /(chức\s+vụ|position|role).*(của|of)\s+\w+/i, // "chức vụ của Minh"
      /\w+\s+(giữ|holds?).*(chức\s+vụ|position|role)/i, // "Minh giữ chức vụ"
      /(doanh\s+thu|revenue|profit).*(của|of)\s+\w+/i, // "doanh thu của PDH"
      /(bao\s+nhiêu|how\s+many).*(nhân\s+viên|employees|staff)/i // "bao nhiêu nhân viên"
    ];
    
    // Document listing patterns
    const documentListPatterns = [
      /(các|danh\s+sách|list)\s+(quy\s+định|quy\s+trình|policies|processes)/,
      /(quy\s+định|quy\s+trình|policies|processes)\s+(hiện\s+tại|current|của\s+\w+)/,
      /(có\s+những|what)\s+(quy\s+định|quy\s+trình|policies|processes)/
    ];
    
    // Check for specific policy keywords
    for (const keyword of specificPolicyKeywords) {
      if (questionLower.includes(keyword)) {
        return true;
      }
    }
    
    // Check for document list keywords
    for (const keyword of documentListKeywords) {
      if (questionLower.includes(keyword)) {
        return true;
      }
    }
    
    // Check for patterns
    for (const pattern of companyPolicyPatterns) {
      if (pattern.test(questionLower)) {
        return true;
      }
    }
    
    // Check for document list patterns
    for (const pattern of documentListPatterns) {
      if (pattern.test(questionLower)) {
        return true;
      }
    }
    
    return false;
  }

  // Process document listing questions
  async processDocumentListQuestion(question, startTime) {
    try {
      console.log(`📋 Processing document listing question: ${question}`);
      
      // Extract company from question (default to PDH if not specified)
      const company = this.extractCompanyFromQuestion(question) || 'PDH';
      console.log(`🏢 Target company: ${company}`);
      
      // Get documents for the company
      const documents = await db.getDocumentsByCompany(company);
      console.log(`📄 Found ${documents.length} documents for ${company}`);
      
      if (documents.length === 0) {
        const answer = `Hiện tại chưa có quy định hoặc quy trình nào được upload cho công ty ${company}. Vui lòng upload tài liệu để có thể trả lời câu hỏi này.`;
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
      
      // Group documents by category
      const categorizedDocs = {};
      documents.forEach(doc => {
        const category = doc.category || 'Khác';
        if (!categorizedDocs[category]) {
          categorizedDocs[category] = [];
        }
        categorizedDocs[category].push(doc);
      });
      
      // Generate formatted answer
      let answer = `📋 **Các quy định và quy trình hiện tại của ${company}:**\n\n`;
      
      Object.keys(categorizedDocs).forEach(category => {
        answer += `📂 **${category}:**\n`;
        categorizedDocs[category].forEach(doc => {
          answer += `• ${doc.original_name}\n`;
        });
        answer += '\n';
      });
      
      answer += `\n💡 *Tổng cộng: ${documents.length} tài liệu*\n`;
      answer += `📅 *Cập nhật gần nhất: ${new Date().toLocaleDateString('vi-VN')}*`;
      
      const responseTime = Date.now() - startTime;
      
      await db.createQuestion({
        question,
        answer,
        documentIds: documents.map(doc => doc.id),
        responseTime
      });
      
      return {
        answer,
        documentIds: documents.map(doc => doc.id),
        relevantDocuments: documents.map(doc => ({
          id: doc.id,
          name: doc.original_name,
          category: doc.category,
          uploadDate: doc.upload_date
        })),
        responseTime
      };
      
    } catch (error) {
      console.error('Error processing document list question:', error);
      throw error;
    }
  }

  // Extract company code from question
  extractCompanyFromQuestion(question) {
    const companies = ['PDH', 'PDI', 'PDE', 'PDHH', 'RH'];
    const questionUpper = question.toUpperCase();
    
    for (const company of companies) {
      if (questionUpper.includes(company)) {
        return company;
      }
    }
    
    return null;
  }

  // Check if question is asking for document listing
  isDocumentListQuestion(question) {
    const questionLower = question.toLowerCase();
    
    const documentListKeywords = [
      'các quy định', 'các quy trình', 'quy định quy trình',
      'danh sách quy định', 'danh sách quy trình',
      'quy định hiện tại', 'quy trình hiện tại',
      'có những quy định', 'có những quy trình'
    ];
    
    const documentListPatterns = [
      /(các|danh\s+sách|list)\s+(quy\s+định|quy\s+trình|policies|processes)/,
      /(quy\s+định|quy\s+trình|policies|processes)\s+(hiện\s+tại|current|của\s+\w+)/,
      /(có\s+những|what)\s+(quy\s+định|quy\s+trình|policies|processes)/
    ];
    
    // Check for document list keywords
    for (const keyword of documentListKeywords) {
      if (questionLower.includes(keyword)) {
        return true;
      }
    }
    
    // Check for document list patterns
    for (const pattern of documentListPatterns) {
      if (pattern.test(questionLower)) {
        return true;
      }
    }
    
    return false;
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

      // Check if this is a knowledge-priority question (vacation, leave, specific policies)
      const isKnowledgePriority = this.isKnowledgePriorityQuestion(question);
      console.log(`📚 Knowledge priority check: ${isKnowledgePriority}`);
      
      if (isKnowledgePriority) {
        console.log(`📚 Checking knowledge base first for priority question`);
        
        // Check if this is a document listing question
        const isDocumentList = this.isDocumentListQuestion(question);
        
        if (isDocumentList) {
          console.log(`📋 Processing document listing question`);
          return await this.processDocumentListQuestion(question, startTime);
        }
        
        // For other knowledge priority questions, check knowledge base
        const knowledgeResults = await this.searchService.searchKnowledgeBase(question);
        
        if (knowledgeResults.length > 0) {
          console.log(`✅ Found ${knowledgeResults.length} knowledge entries, using knowledge base`);
          return await this.aiService.processWithKnowledge(question, knowledgeResults, startTime);
        }
        console.log(`❌ No knowledge found, continuing with normal flow`);
      }

      // Check constraints (high priority for general questions)
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