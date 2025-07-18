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
   * Phân tích câu hỏi để xác định intent và nguồn dữ liệu
   * @param {string} question - Câu hỏi của người dùng
   * @param {string} sessionId - ID phiên hội thoại
   * @returns {Object} Kết quả phân tích
   */
  async analyzeQuestion(question, sessionId) {
    try {
      console.log(`🔍 Analyzing question: "${question}"`);
      
      // Lấy context từ session
      const context = await this.getSessionContext(sessionId);
      
      // Chuẩn bị dữ liệu cho phân tích
      const questionLower = question.toLowerCase();
      
      // Phân tích intent
      const intent = this.detectIntent(questionLower);
      
      // Phân tích nguồn dữ liệu
      const source = this.detectDataSource(questionLower, intent);
      
      // Phân tích chủ đề
      const topic = this.detectTopic(questionLower);
      
      // Phân tích công ty
      const company = await this.detectCompany(questionLower);
      
      // Phân tích phòng ban
      const department = this.detectDepartment(questionLower);
      
      // Tính toán độ tin cậy
      const confidence = this.calculateConfidence(intent, source, topic, company, department);
      
      console.log(`✅ Analysis result:`, { intent, source, topic, company, department, confidence });
      
      return {
        intent,
        source,
        topic,
        company,
        department,
        confidence,
        sessionContext: context,
        error: null
      };
    } catch (error) {
      console.error('Error analyzing question:', error);
      return {
        intent: 'unknown',
        source: 'unknown',
        topic: null,
        company: null,
        department: null,
        confidence: 0,
        sessionContext: {},
        error: error.message
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
   * Phát hiện intent từ câu hỏi
   * @param {string} question - Câu hỏi của người dùng
   * @returns {string} Intent của câu hỏi
   */
  detectIntent(question) {
    // Kiểm tra intent danh sách tài liệu
    if (/(danh sách|liệt kê|list|show|hiển thị|xem).*(tài liệu|document|file|văn bản|quy định|quy trình)/i.test(question)) {
      return 'list_documents';
    }
    
    // Kiểm tra intent tìm kiếm tài liệu cụ thể
    if (/(tìm|search|look for|find).*(tài liệu|document|file|văn bản|quy định|quy trình)/i.test(question)) {
      return 'search_document';
    }
    
    // Kiểm tra intent tóm tắt tài liệu
    if (/(tóm tắt|summary|summarize|tóm lược).*(tài liệu|document|file|văn bản|quy định|quy trình)/i.test(question)) {
      return 'summarize_document';
    }
    
    // Kiểm tra intent thông tin công ty
    if (/(thông tin|information|info|giới thiệu|về).*(công ty|company)/i.test(question)) {
      return 'company_info';
    }
    
    // Kiểm tra intent hỏi về người lãnh đạo
    if (/(ai|who|người nào).*(giám đốc|ceo|chủ tịch|chairman|lãnh đạo|leader)/i.test(question)) {
      return 'leadership_info';
    }
    
    // Mặc định là câu hỏi chung
    return 'general_question';
  }

  /**
   * Phát hiện nguồn dữ liệu từ câu hỏi và intent
   * @param {string} question - Câu hỏi của người dùng
   * @param {string} intent - Intent của câu hỏi
   * @returns {string} Nguồn dữ liệu
   */
  detectDataSource(question, intent) {
    // Nếu câu hỏi liên quan đến tài liệu
    if (/(tài liệu|document|file|văn bản|quy định|quy trình)/i.test(question) || 
        intent === 'list_documents' || 
        intent === 'search_document' || 
        intent === 'summarize_document') {
      return 'documents';
    }
    
    // Nếu câu hỏi liên quan đến thông tin công ty
    if (/(công ty|company|tổ chức|organization)/i.test(question) || 
        intent === 'company_info' || 
        intent === 'leadership_info') {
      return 'knowledge_base';
    }
    
    // Nếu có cả hai, sử dụng cả hai nguồn
    if (/(tài liệu|document).*(công ty|company)/i.test(question) || 
        /(công ty|company).*(tài liệu|document)/i.test(question)) {
      return 'hybrid';
    }
    
    // Mặc định sử dụng constraints
    return 'constraints';
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
   * Phát hiện chủ đề từ câu hỏi
   * @param {string} question - Câu hỏi của người dùng
   * @returns {string|null} Chủ đề hoặc null nếu không tìm thấy
   */
  detectTopic(question) {
    // Danh sách các chủ đề và pattern tương ứng
    const topics = [
      { pattern: /(quy trình|process|procedure|workflow)/i, topic: 'process' },
      { pattern: /(quy định|regulation|rule|policy)/i, topic: 'regulation' },
      { pattern: /(báo cáo|report|reporting)/i, topic: 'report' },
      { pattern: /(tài chính|financial|finance|kế toán|accounting)/i, topic: 'financial' },
      { pattern: /(nhân sự|hr|human resource|personnel)/i, topic: 'hr' },
      { pattern: /(marketing|tiếp thị|quảng cáo|advertising)/i, topic: 'marketing' },
      { pattern: /(sản xuất|production|manufacturing)/i, topic: 'production' },
      { pattern: /(công nghệ|technology|it|phần mềm|software)/i, topic: 'technology' },
      { pattern: /(pháp lý|legal|luật|law)/i, topic: 'legal' }
    ];
    
    // Kiểm tra từng pattern
    for (const { pattern, topic } of topics) {
      if (pattern.test(question)) {
        return topic;
      }
    }
    
    return null;
  }

  /**
   * Tính toán độ tin cậy của phân tích
   * @param {string} intent - Intent của câu hỏi
   * @param {string} source - Nguồn dữ liệu
   * @param {string|null} topic - Chủ đề
   * @param {string|null} company - Công ty
   * @param {string|null} department - Phòng ban
   * @returns {number} Độ tin cậy (0-100)
   */
  calculateConfidence(intent, source, topic, company, department) {
    let confidence = 50; // Điểm cơ bản
    
    // Tăng điểm nếu có intent rõ ràng
    if (intent && intent !== 'general_question') {
      confidence += 10;
    }
    
    // Tăng điểm nếu có nguồn dữ liệu cụ thể
    if (source && source !== 'constraints') {
      confidence += 10;
    }
    
    // Tăng điểm nếu có chủ đề
    if (topic) {
      confidence += 10;
    }
    
    // Tăng điểm nếu có công ty
    if (company) {
      confidence += 10;
    }
    
    // Tăng điểm nếu có phòng ban
    if (department) {
      confidence += 10;
    }
    
    // Đảm bảo confidence không vượt quá 100
    return Math.min(confidence, 100);
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
   * Phát hiện công ty từ câu hỏi
   * @param {string} question - Câu hỏi của người dùng
   * @returns {string|null} Mã công ty hoặc null nếu không tìm thấy
   */
  async detectCompany(question) {
    try {
      // Lấy tất cả công ty từ database
      const { pool } = require('../../config/database');
      const client = await pool.connect();
      try {
        // Lấy tất cả công ty từ database
        const result = await client.query(`
          SELECT company_code, company_name, short_name, description
          FROM companies
        `);
        
        if (result.rows.length === 0) {
          console.log('⚠️ Không tìm thấy công ty nào trong database');
          return null;
        }
        
        // Chuẩn bị từ khóa tìm kiếm
        const normalizedQuestion = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Tạo danh sách các mẫu tìm kiếm từ dữ liệu công ty
        const companyPatterns = [];
        
        for (const company of result.rows) {
          // Tạo pattern từ mã công ty
          const codePattern = new RegExp(`\\b${company.company_code.toLowerCase()}\\b`, 'i');
          companyPatterns.push({ pattern: codePattern, code: company.company_code });
          
          // Tạo pattern từ tên công ty
          if (company.company_name) {
            const namePattern = new RegExp(`\\b${company.company_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}\\b`, 'i');
            companyPatterns.push({ pattern: namePattern, code: company.company_code });
          }
          
          // Tạo pattern từ tên viết tắt
          if (company.short_name) {
            const shortNamePattern = new RegExp(`\\b${company.short_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}\\b`, 'i');
            companyPatterns.push({ pattern: shortNamePattern, code: company.company_code });
          }
        }
        
        // Kiểm tra từng pattern
        for (const { pattern, code } of companyPatterns) {
          if (pattern.test(normalizedQuestion)) {
            console.log(`🏢 Detected company: ${code}`);
            return code;
          }
        }
        
        // Nếu không tìm thấy bằng pattern, thử tìm kiếm từng phần
        for (const company of result.rows) {
          const companyCode = company.company_code.toLowerCase();
          const companyName = company.company_name ? company.company_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
          const shortName = company.short_name ? company.short_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
          
          if (normalizedQuestion.includes(companyCode.toLowerCase()) || 
              (companyName && normalizedQuestion.includes(companyName)) || 
              (shortName && normalizedQuestion.includes(shortName))) {
            console.log(`🏢 Detected company from partial match: ${company.company_code}`);
            return company.company_code;
          }
        }
        
        return null;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error detecting company:', error);
      return null;
    }
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