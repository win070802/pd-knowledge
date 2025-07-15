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
    const questionLower = question.toLowerCase();
    
    // Document listing questions should NOT prioritize knowledge base
    const documentKeywords = [
      'danh sách tài liệu', 'danh sách document', 'các tài liệu', 'các document',
      'tài liệu nào', 'document nào', 'files nào', 'documents thuộc',
      'tài liệu của', 'document của', 'list document', 'list tài liệu'
    ];
    
    const hasDocumentKeywords = documentKeywords.some(keyword => 
      questionLower.includes(keyword)
    );
    
    if (hasDocumentKeywords) {
      console.log(`📄 Document listing question detected, using document search`);
      return false;
    }
    
    // First check if it's company-related (for knowledge content)
    if (this.isCompanyRelatedQuestion(question)) {
      console.log(`🏢 Company-related question detected, prioritizing knowledge base`);
      return true;
    }
    
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
      /(các|danh\s+sách|list)\s+(quy\s+định|quy\s+trình|policies|processes|tài\s+liệu|document)/,
      /(quy\s+định|quy\s+trình|policies|processes|tài\s+liệu|document)\s+(hiện\s+tại|current|của\s+\w+|thuộc\s+\w+)/,
      /(có\s+những|what)\s+(quy\s+định|quy\s+trình|policies|processes|tài\s+liệu|document)/
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
      'có những quy định', 'có những quy trình',
      'danh sách tài liệu', 'danh sách document', 'các tài liệu', 'các document',
      'tài liệu nào', 'document nào', 'files nào', 'documents thuộc',
      'tài liệu của', 'document của', 'list document', 'list tài liệu'
    ];
    
    const documentListPatterns = [
      /(các|danh\s+sách|list)\s+(quy\s+định|quy\s+trình|policies|processes|tài\s+liệu|document)/,
      /(quy\s+định|quy\s+trình|policies|processes|tài\s+liệu|document)\s+(hiện\s+tại|current|của\s+\w+|thuộc\s+\w+)/,
      /(có\s+những|what)\s+(quy\s+định|quy\s+trình|policies|processes|tài\s+liệu|document)/
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

      // 🧠 AI-powered intent analysis (replaces rigid keyword matching)
      console.log(`🧠 Analyzing question intent with AI...`);
      const intent = await this.analyzeQuestionIntent(question);
      
      // Route question based on AI analysis
      console.log(`🎯 Routing question based on intent: ${intent.intent}`);
      return await this.routeQuestionByIntent(question, intent);
      
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

  // AI-powered intent analysis to replace rigid keyword matching
  async analyzeQuestionIntent(question) {
    try {
      const analysisPrompt = `
Phân tích câu hỏi sau đây và trả về JSON format với các thông tin:

Câu hỏi: "${question}"

Hãy phân tích:
1. INTENT: Người dùng muốn gì? (list_documents, find_knowledge, hybrid_search, general_question)
2. TARGET: Tìm gì? (documents, knowledge, both)  
3. COMPANY: Công ty nào? (PDH, PDI, PDE, PDHH, RH, hoặc null)
4. CATEGORY: Loại thông tin? (IT, HR, Finance, Legal, Operations, hoặc null)
5. CONFIDENCE: Độ tin cậy (0-100)

Các INTENT types:
- list_documents: Muốn xem danh sách, liệt kê tài liệu/file
- find_knowledge: Hỏi về thông tin cụ thể đã học (nhân sự, quy trình...)
- hybrid_search: Cần tìm trong cả documents + knowledge 
- general_question: Câu hỏi chung chung

QUAN TRỌNG - Các từ khóa chỉ hybrid_search:
- "tóm tắt", "giải thích", "mô tả", "chi tiết về"
- "quy trình", "quy định", "chính sách", "hướng dẫn"
- "nội dung", "thông tin trong", "theo tài liệu"
- "hệ thống", "cơ chế", "cách thức"

Ví dụ phân tích:
"Danh sách tài liệu PDH" → {"intent":"list_documents","target":"documents","company":"PDH","category":null,"confidence":95}
"Team IT có mấy người?" → {"intent":"find_knowledge","target":"knowledge","company":"PDH","category":"IT","confidence":90}
"Quy định về làm việc từ xa?" → {"intent":"hybrid_search","target":"both","company":null,"category":"HR","confidence":85}
"Tóm tắt quy trình thanh toán" → {"intent":"hybrid_search","target":"both","company":"PDH","category":"Finance","confidence":90}
"Giải thích chính sách bảo mật" → {"intent":"hybrid_search","target":"both","company":"PDH","category":"IT","confidence":85}

Chỉ trả về JSON, không giải thích:`;

      const result = await this.aiService.model.generateContent(analysisPrompt);
      const response = result.response;
      const text = response.text();
      
      // Extract JSON from response
      console.log(`🧠 Raw AI response:`, text);
      
      // Try to find JSON in the response
      let analysis = null;
      
      // First try: Find complete JSON object
      const jsonMatch = text.match(/\{[^{}]*\}/);
      if (jsonMatch) {
        try {
          analysis = JSON.parse(jsonMatch[0]);
          console.log(`🧠 AI Intent Analysis:`, analysis);
          return analysis;
        } catch (parseError) {
          console.error('JSON parse error:', parseError);
        }
      }
      
      // Second try: Extract key-value pairs manually
      const intentMatch = text.match(/"intent"\s*:\s*"([^"]+)"/);
      const targetMatch = text.match(/"target"\s*:\s*"([^"]+)"/);
      const companyMatch = text.match(/"company"\s*:\s*"?([^",}]+)"?/);
      const confidenceMatch = text.match(/"confidence"\s*:\s*(\d+)/);
      
      if (intentMatch) {
        analysis = {
          intent: intentMatch[1],
          target: targetMatch ? targetMatch[1] : 'both',
          company: companyMatch ? companyMatch[1] : null,
          category: null,
          confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 70
        };
        console.log(`🧠 Manually parsed intent:`, analysis);
        return analysis;
      }
      
      // Fallback to basic analysis
      return {
        intent: 'general_question',
        target: 'both', 
        company: this.extractCompanyFromQuestion(question),
        category: null,
        confidence: 50
      };
      
    } catch (error) {
      console.error('Error in intent analysis:', error);
      // Fallback to basic logic
      return {
        intent: 'general_question',
        target: 'both',
        company: this.extractCompanyFromQuestion(question),
        category: null,
        confidence: 30
      };
    }
  }

  // Smart routing based on AI intent analysis
  async routeQuestionByIntent(question, intent) {
    const startTime = Date.now();
    
    switch (intent.intent) {
      case 'list_documents':
        console.log(`📋 Routing to document listing`);
          return await this.processDocumentListQuestion(question, startTime);
        
      case 'find_knowledge':
        console.log(`🧠 Routing to knowledge search`);
        const knowledgeResults = await this.searchService.searchKnowledgeBase(question);
        if (knowledgeResults.length > 0) {
          return await this.aiService.processWithKnowledge(question, knowledgeResults, startTime);
        }
        // Fallback to document search if no knowledge found
        console.log(`📄 Fallback to document search`);
        const documentResults = await this.searchService.searchDocuments(question);
        if (documentResults.length > 0) {
          return await this.aiService.processWithDocuments(question, documentResults, startTime);
        }
        return await this.processGeneralQuestion(question, startTime);
        
      case 'hybrid_search':
        console.log(`🔄 Routing to hybrid search (knowledge + documents)`);
        return await this.processHybridSearch(question, intent, startTime);
        
      default:
        console.log(`❓ Routing to general question processing`);
        return await this.processGeneralQuestion(question, startTime);
    }
      }

  // Hybrid search: combines knowledge + documents
  async processHybridSearch(question, intent, startTime) {
    try {
      console.log(`🔄 Processing hybrid search for: ${question}`);
      
      // Search both sources in parallel
      const [knowledgeResults, documentResults] = await Promise.all([
        this.searchService.searchKnowledgeBase(question),
        this.searchService.searchDocuments(question, intent.company)
      ]);
      
      console.log(`📚 Knowledge results: ${knowledgeResults.length}`);
      console.log(`📄 Document results: ${documentResults.length}`);
      
      // Prioritize based on confidence and relevance
      if (knowledgeResults.length > 0 && intent.confidence > 70) {
        console.log(`✅ High confidence knowledge found, using knowledge base`);
        return await this.aiService.processWithKnowledge(question, knowledgeResults, startTime);
      }
      
      if (documentResults.length > 0) {
        console.log(`📄 Using document search results`);
        return await this.aiService.processWithDocuments(question, documentResults, startTime);
      }
      
      // Fallback to general processing
      return await this.processGeneralQuestion(question, startTime);
      
    } catch (error) {
      console.error('Error in hybrid search:', error);
      return await this.processGeneralQuestion(question, startTime);
    }
  }

  // General question processing (existing logic)
  async processGeneralQuestion(question, startTime) {
    // Check constraints first
    const constraintAnswer = this.constraintsService.checkConstraints(question);
      if (constraintAnswer) {
      console.log(`🔒 Constraint matched: ${constraintAnswer}`);
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

    // Continue with existing general question logic...
    const isGeneralQuestion = this.contentClassifier.isGeneralQuestion(question);
    if (isGeneralQuestion) {
      console.log(`💬 Processing as general question`);
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
      
    // Search documents
    console.log(`📄 Searching documents for: ${question}`);
    const documentResults = await this.searchService.searchDocuments(question);
    
    if (documentResults.length > 0) {
      console.log(`📄 Found ${documentResults.length} document results`);
      return await this.aiService.processWithDocuments(question, documentResults, startTime);
    }
    
    // Final fallback
    const answer = 'Xin lỗi, tôi không tìm thấy thông tin liên quan đến câu hỏi của bạn. Vui lòng thử đặt câu hỏi khác hoặc cung cấp thêm chi tiết.';
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
}

module.exports = new GeminiService(); 