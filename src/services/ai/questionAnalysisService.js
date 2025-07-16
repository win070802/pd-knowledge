const { GoogleGenerativeAI } = require('@google/generative-ai');
const { db } = require('../../../database');
const ContentClassifier = require('../../utils/content/contentClassifier');

class QuestionAnalysisService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    this.contentClassifier = new ContentClassifier();
  }

  /**
   * Phân tích câu hỏi để xác định intent, chủ đề và nguồn dữ liệu phù hợp
   * @param {string} question - Câu hỏi của người dùng
   * @param {string} sessionId - ID phiên hội thoại
   * @returns {Object} Kết quả phân tích
   */
  async analyzeQuestion(question, sessionId = null) {
    try {
      console.log(`🔍 Analyzing question: "${question}"`);
      
      // Kiểm tra nội dung nhạy cảm
      const isSensitive = await this.contentClassifier.isSensitiveContent(question);
      if (isSensitive) {
        return {
          intent: 'sensitive_content',
          source: 'none',
          topic: 'sensitive',
          company: null,
          department: null,
          confidence: 100,
          sessionContext: {},
          error: 'Câu hỏi chứa nội dung nhạy cảm không được phép'
        };
      }
      
      // Phân tích ngữ cảnh phiên hội thoại
      let sessionContext = {};
      if (sessionId) {
        sessionContext = await this.getSessionContext(sessionId);
      }
      
      // Kiểm tra nếu câu hỏi là yêu cầu danh sách tài liệu theo công ty
      const documentListPattern = /(danh sách|liệt kê|list|show|hiển thị|xem).*(tài liệu|document|file|văn bản|quy định|quy trình).*(của|thuộc|trong|ở|tại|liên quan đến|about).*?(PDH|PDI|PDE|PDHOS|RHS)/i;
      const documentListPatternCompanyFirst = /(PDH|PDI|PDE|PDHOS|RHS).*(danh sách|liệt kê|list|show|hiển thị|xem).*(tài liệu|document|file|văn bản|quy định|quy trình)/i;
      
      if (documentListPattern.test(question) || documentListPatternCompanyFirst.test(question)) {
        const company = this.extractCompanyFromQuestion(question);
        console.log(`📑 Detected document list request for company: ${company}`);
        return {
          intent: 'list_documents',
          source: 'documents',
          topic: null,
          company: company,
          department: this.detectDepartment(question),
          confidence: 95,
          sessionContext: sessionContext,
          error: null
        };
      }
      
      // Kiểm tra nếu câu hỏi chứa tên tài liệu cụ thể
      const hasSpecificDocumentName = this.detectSpecificDocument(question);
      if (hasSpecificDocumentName) {
        console.log(`📄 Detected specific document name in question`);
        return {
          intent: 'document_specific',
          source: 'documents',
          topic: this.detectTopic(question),
          company: this.extractCompanyFromQuestion(question),
          department: this.detectDepartment(question),
          confidence: 90,
          sessionContext: sessionContext,
          error: null
        };
      }
      
      // Kiểm tra nếu là câu hỏi chung không liên quan đến tài liệu
      const isGeneralQuestion = this.contentClassifier.isGeneralQuestion(question);
      if (isGeneralQuestion && !question.toLowerCase().includes('công ty') && !question.toLowerCase().includes('tài liệu')) {
        console.log(`ℹ️ Detected general knowledge question`);
        return {
          intent: 'general_question',
          source: 'constraints',
          topic: 'general_knowledge',
          company: null,
          department: null,
          confidence: 85,
          sessionContext: sessionContext,
          error: null
        };
      }
      
      // Phân tích intent và chủ đề của câu hỏi
      const intentAnalysis = await this.analyzeQuestionIntent(question);
      
      // Phát hiện phòng ban liên quan
      const department = this.detectDepartment(question);
      
      // Xác định nguồn dữ liệu phù hợp
      const source = this.determineDataSource(intentAnalysis, question);
      
      return {
        intent: intentAnalysis.intent,
        source: source,
        topic: intentAnalysis.category,
        company: intentAnalysis.company,
        department: department,
        confidence: intentAnalysis.confidence,
        sessionContext: sessionContext,
        error: null
      };
    } catch (error) {
      console.error('Error analyzing question:', error);
      return {
        intent: 'general_question',
        source: 'constraints',
        topic: null,
        company: null,
        department: null,
        confidence: 30,
        sessionContext: {},
        error: 'Lỗi khi phân tích câu hỏi'
      };
    }
  }
  
  /**
   * Phân tích intent của câu hỏi
   * @param {string} question - Câu hỏi cần phân tích
   * @returns {Object} Kết quả phân tích intent
   */
  async analyzeQuestionIntent(question) {
    try {
      // Kiểm tra trước bằng các pattern đặc biệt
      const questionLower = question.toLowerCase();
      
      // Pattern cho danh sách tài liệu
      if (/(danh sách|list|liệt kê|show|hiển thị|xem).*(tài liệu|document|file|văn bản|quy định|quy trình)/i.test(questionLower)) {
        const company = this.extractCompanyFromQuestion(question);
        return {
          intent: 'list_documents',
          target: 'documents',
          company: company,
          category: null,
          confidence: 90
        };
      }
      
      // Pattern cho danh sách công ty
      if (/(danh sách|list|liệt kê|show|hiển thị|xem).*(công ty|company|tập đoàn|group)/i.test(questionLower)) {
        return {
          intent: 'list_companies',
          target: 'knowledge',
          company: null,
          category: null,
          confidence: 90
        };
      }
      
      const analysisPrompt = `
Phân tích câu hỏi sau đây và trả về JSON format với các thông tin:

Câu hỏi: "${question}"

Hãy phân tích:
1. INTENT: Người dùng muốn gì? (list_companies, list_documents, find_knowledge, hybrid_search, general_question)
2. TARGET: Tìm gì? (documents, knowledge, both)  
3. COMPANY: Công ty nào? (PDH, PDI, PDE, PDHOS, RHS, hoặc null)
4. CATEGORY: Loại thông tin? (IT, HR, Finance, Legal, Operations, hoặc null)
5. CONFIDENCE: Độ tin cậy (0-100)

Các INTENT types:
- list_companies: Muốn xem danh sách các công ty trong tập đoàn
- list_documents: Muốn xem danh sách, liệt kê tài liệu/file
- find_knowledge: Hỏi về thông tin cụ thể đã học (nhân sự, quy trình...)
- hybrid_search: Cần tìm trong cả documents + knowledge 
- general_question: Câu hỏi chung chung

Các từ khóa chỉ hybrid_search:
- "tóm tắt", "giải thích", "mô tả", "chi tiết về"
- "quy trình", "quy định", "chính sách", "hướng dẫn"
- "nội dung", "thông tin trong", "theo tài liệu"
- "hệ thống", "cơ chế", "cách thức"

Các từ khóa chỉ list_documents:
- "danh sách tài liệu", "liệt kê tài liệu", "liệt kê file"
- "tài liệu thuộc", "tài liệu của", "tài liệu liên quan đến"
- "xem tài liệu của", "hiển thị tài liệu"

Chỉ trả về JSON, không giải thích:`;

      const result = await this.model.generateContent(analysisPrompt);
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
      const categoryMatch = text.match(/"category"\s*:\s*"?([^",}]+)"?/);
      const confidenceMatch = text.match(/"confidence"\s*:\s*(\d+)/);
      
      if (intentMatch) {
        analysis = {
          intent: intentMatch[1],
          target: targetMatch ? targetMatch[1] : 'both',
          company: companyMatch ? companyMatch[1] : null,
          category: categoryMatch ? categoryMatch[1] : null,
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
  
  /**
   * Phát hiện phòng ban từ câu hỏi
   * @param {string} question - Câu hỏi cần phân tích
   * @returns {string|null} Tên phòng ban hoặc null
   */
  detectDepartment(question) {
    const questionLower = question.toLowerCase();
    
    // Các từ khóa phòng ban
    const departmentKeywords = {
      'it': ['it', 'công nghệ thông tin', 'cntt', 'phòng it', 'ban it', 'technology'],
      'hr': ['hr', 'nhân sự', 'human resource', 'phòng nhân sự', 'ban nhân sự', 'tuyển dụng'],
      'finance': ['tài chính', 'finance', 'kế toán', 'accounting', 'phòng tài chính', 'ban tài chính'],
      'legal': ['pháp chế', 'legal', 'pháp lý', 'phòng pháp chế', 'ban pháp chế'],
      'operations': ['vận hành', 'operations', 'phòng vận hành', 'ban vận hành'],
      'sales': ['kinh doanh', 'sales', 'bán hàng', 'phòng kinh doanh', 'ban kinh doanh'],
      'marketing': ['marketing', 'tiếp thị', 'phòng marketing', 'ban marketing']
    };
    
    // Kiểm tra từng phòng ban
    for (const [dept, keywords] of Object.entries(departmentKeywords)) {
      for (const keyword of keywords) {
        if (questionLower.includes(keyword)) {
          return dept;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Xác định nguồn dữ liệu phù hợp cho câu hỏi
   * @param {Object} intentAnalysis - Kết quả phân tích intent
   * @param {string} question - Câu hỏi gốc
   * @returns {string} Nguồn dữ liệu (documents, knowledge, constraints, hybrid)
   */
  determineDataSource(intentAnalysis, question) {
    // Kiểm tra câu hỏi chung chung
    if (this.contentClassifier.isGeneralQuestion(question)) {
      return 'constraints';
    }
    
    // Xác định nguồn dữ liệu dựa trên intent
    switch (intentAnalysis.intent) {
      case 'list_documents':
        return 'documents';
      
      case 'list_companies':
        return 'knowledge';
      
      case 'find_knowledge':
        return 'knowledge';
      
      case 'hybrid_search':
        return 'hybrid';
      
      case 'general_question':
        return 'constraints';
      
      default:
        // Phân tích câu hỏi để xác định nếu cần hybrid search
        const hybridKeywords = [
          'tóm tắt', 'summary', 'giải thích', 'explain', 'mô tả', 'describe',
          'chi tiết', 'detail', 'nội dung', 'content', 'tài liệu nào', 'which document',
          'hướng dẫn', 'guide', 'instructions'
        ];
        
        const questionLower = question.toLowerCase();
        const needsHybridSearch = hybridKeywords.some(keyword => questionLower.includes(keyword));
        
        return needsHybridSearch ? 'hybrid' : 'documents';
    }
  }

  /**
   * Trích xuất tên công ty từ câu hỏi
   * @param {string} question - Câu hỏi cần phân tích
   * @returns {string|null} Tên công ty hoặc null
   */
  extractCompanyFromQuestion(question) {
    try {
      // Danh sách các mã công ty
      const companyPatterns = [
        { pattern: /\b(pdh|phát đạt holdings|phat dat holdings)\b/i, code: 'PDH' },
        { pattern: /\b(pdi|phát đạt invest|phat dat invest)\b/i, code: 'PDI' },
        { pattern: /\b(pde|phát đạt edu|phat dat edu|phát đạt education)\b/i, code: 'PDE' },
        { pattern: /\b(pdhos|phát đạt hospital|phat dat hospital|phát đạt bệnh viện)\b/i, code: 'PDHOS' },
        { pattern: /\b(rhs|roman hospital|bệnh viện roman)\b/i, code: 'RHS' }
      ];
      
      const questionLower = question.toLowerCase();
      
      // Tìm công ty trong câu hỏi
      for (const company of companyPatterns) {
        if (company.pattern.test(questionLower)) {
          return company.code;
        }
      }
      
      // Kiểm tra chuỗi được bọc trong dấu ngoặc - có thể là mã công ty
      const bracketMatch = question.match(/\(([A-Z0-9]{3,6})\)/);
      if (bracketMatch) {
        const possibleCompanyCode = bracketMatch[1];
        const validCompanyCodes = ['PDH', 'PDI', 'PDE', 'PDHOS', 'RHS'];
        if (validCompanyCodes.includes(possibleCompanyCode)) {
          return possibleCompanyCode;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting company:', error);
      return null;
    }
  }

  /**
   * Phát hiện tên tài liệu cụ thể trong câu hỏi
   * @param {string} question - Câu hỏi cần phân tích
   * @returns {boolean} Có phát hiện tên tài liệu cụ thể hay không
   */
  detectSpecificDocument(question) {
    // Kiểm tra các định dạng tài liệu cụ thể
    const documentPatterns = [
      /\b[A-Z0-9]{2,10}-[A-Z0-9]{2,10}(-[A-Z0-9]{2,10})*\b/, // Mã tài liệu: QT-NS-01
      /\b\w+\.(pdf|docx?|xlsx?|pptx?|txt)\b/i, // Tên file với extension
      /"([^"]+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt))"/i, // Tên file trong dấu ngoặc kép
      /'([^']+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt))'/i, // Tên file trong dấu ngoặc đơn
      /\b(quy trình|quy định|chính sách|hướng dẫn|sơ đồ|biểu mẫu) [a-zA-Z0-9\s]{3,30}\b/i, // "quy trình làm việc"
      /\b(process|policy|procedure|guideline|form|template) [a-zA-Z0-9\s]{3,30}\b/i // "leave policy"
    ];
    
    return documentPatterns.some(pattern => pattern.test(question));
  }
  
  /**
   * Phát hiện chủ đề từ câu hỏi
   * @param {string} question - Câu hỏi cần phân tích
   * @returns {string|null} Chủ đề hoặc null
   */
  detectTopic(question) {
    const questionLower = question.toLowerCase();
    
    // Từ khóa theo chủ đề
    const topicKeywords = {
      'hr': [
        'nhân sự', 'human resources', 'hr', 'tuyển dụng', 'recruitment',
        'nghỉ phép', 'leave', 'đào tạo', 'training', 'lương', 'salary',
        'thưởng', 'bonus', 'phúc lợi', 'benefits', 'nhân viên', 'employee',
        'đánh giá', 'evaluation', 'kỷ luật', 'discipline', 'văn hóa', 'culture'
      ],
      'finance': [
        'tài chính', 'finance', 'kế toán', 'accounting', 'chi phí', 'expense',
        'ngân sách', 'budget', 'lương', 'salary', 'thuế', 'tax', 'doanh thu', 'revenue',
        'báo cáo tài chính', 'financial report', 'chi tiêu', 'spending',
        'thanh toán', 'payment', 'hóa đơn', 'invoice'
      ],
      'legal': [
        'pháp chế', 'legal', 'luật', 'law', 'hợp đồng', 'contract',
        'thỏa thuận', 'agreement', 'bản ghi nhớ', 'mou', 'tuân thủ', 'compliance',
        'tranh chấp', 'dispute', 'kiện tụng', 'litigation', 'sở hữu trí tuệ', 'ip'
      ],
      'operations': [
        'vận hành', 'operations', 'quy trình', 'process', 'sop', 'workflow',
        'chuỗi cung ứng', 'supply chain', 'logistics', 'vận chuyển', 'shipping',
        'sản xuất', 'production', 'chất lượng', 'quality', 'bảo trì', 'maintenance'
      ],
      'it': [
        'it', 'công nghệ thông tin', 'cntt', 'phần mềm', 'software',
        'phần cứng', 'hardware', 'hệ thống', 'system', 'mạng', 'network',
        'bảo mật', 'security', 'dữ liệu', 'data', 'ứng dụng', 'application'
      ],
      'marketing': [
        'marketing', 'tiếp thị', 'quảng cáo', 'advertising', 'branding', 'thương hiệu',
        'chiến dịch', 'campaign', 'truyền thông', 'communication', 'pr', 'quảng bá',
        'khách hàng', 'customer', 'thị trường', 'market', 'seo', 'sem'
      ],
      'sales': [
        'kinh doanh', 'sales', 'bán hàng', 'selling', 'khách hàng', 'customer',
        'doanh số', 'revenue', 'target', 'mục tiêu', 'commission', 'hoa hồng',
        'đối tác', 'partner', 'hợp đồng', 'contract', 'b2b', 'b2c'
      ],
      'general': [
        'công ty', 'company', 'tổ chức', 'organization', 'chung', 'general',
        'nội quy', 'rules', 'quy định', 'regulations', 'chính sách', 'policy'
      ]
    };
    
    // Phát hiện chủ đề theo từ khóa
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      for (const keyword of keywords) {
        if (questionLower.includes(keyword)) {
          return topic;
        }
      }
    }
    
    // Trích xuất chủ đề từ mã tài liệu (VD: QT-NS-01 -> hr, QT-TC-02 -> finance)
    const docCodeMatch = question.match(/\b([A-Z]{2,3})-([A-Z]{2,3})-\d+\b/);
    if (docCodeMatch) {
      const deptCode = docCodeMatch[2].toUpperCase();
      const deptMapping = {
        'NS': 'hr',
        'TC': 'finance',
        'PC': 'legal',
        'VH': 'operations',
        'IT': 'it',
        'MKT': 'marketing',
        'KD': 'sales',
        'QT': 'general'
      };
      
      if (deptMapping[deptCode]) {
        return deptMapping[deptCode];
      }
    }
    
    return null;
  }

  /**
   * Lấy ngữ cảnh phiên hội thoại
   * @param {string} sessionId - ID phiên hội thoại
   * @returns {Object} Ngữ cảnh phiên
   */
  async getSessionContext(sessionId) {
    try {
      const { pool } = require('../../config/database');
      
      // Get conversation context
      const sessionQuery = await pool.query(
        'SELECT context FROM conversations WHERE session_id = $1 AND is_active = true',
        [sessionId]
      );
      
      if (sessionQuery.rows.length > 0) {
        return sessionQuery.rows[0].context || {};
      }
      
      return {};
    } catch (error) {
      console.error('Error getting session context:', error);
      return {};
    }
  }
}

module.exports = QuestionAnalysisService; 