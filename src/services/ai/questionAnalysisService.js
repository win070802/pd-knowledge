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
      case 'list_companies':
        return 'knowledge';
        
      case 'list_documents':
        return 'documents';
        
      case 'find_knowledge':
        return 'knowledge';
        
      case 'hybrid_search':
        return 'hybrid';
        
      case 'general_question':
        // Kiểm tra câu hỏi liên quan đến tài liệu cụ thể
        if (this.contentClassifier.isDocumentSpecificQuestion(question)) {
          return 'documents';
        }
        return 'constraints';
        
      default:
        return 'constraints';
    }
  }
  
  /**
   * Trích xuất thông tin công ty từ câu hỏi
   * @param {string} question - Câu hỏi cần phân tích
   * @returns {string|null} Mã công ty hoặc null
   */
  extractCompanyFromQuestion(question) {
    const questionLower = question.toLowerCase();
    const companyPatterns = [
      { code: 'PDH', patterns: [/\bpdh\b/, /\bphát đạt holding\b/, /\bphat dat holding\b/] },
      { code: 'PDI', patterns: [/\bpdi\b/, /\bphát đạt invest\b/, /\bphat dat invest\b/] },
      { code: 'PDE', patterns: [/\bpde\b/, /\bphát đạt express\b/, /\bphat dat express\b/] },
      { code: 'PDHOS', patterns: [/\bpdhos\b/, /\bphát đạt hospitality\b/, /\bphat dat hospitality\b/] },
      { code: 'RHS', patterns: [/\brhs\b/, /\broyal hospitality\b/, /\broyal\b/] }
    ];
    
    for (const company of companyPatterns) {
      for (const pattern of company.patterns) {
        if (pattern.test(questionLower)) {
          return company.code;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Lấy ngữ cảnh từ phiên hội thoại
   * @param {string} sessionId - ID phiên hội thoại
   * @returns {Object} Ngữ cảnh phiên
   */
  async getSessionContext(sessionId) {
    try {
      const sessionQuery = await db.query(
        'SELECT context FROM conversations WHERE session_id = $1 AND is_active = true',
        [sessionId]
      );
      
      return sessionQuery.rows.length > 0 ? sessionQuery.rows[0].context || {} : {};
    } catch (error) {
      console.error('Error getting session context:', error);
      return {};
    }
  }
}

module.exports = QuestionAnalysisService; 