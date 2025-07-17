const { db } = require('../../../database');

class DataIntegrationService {
  constructor() {
    this.dataCache = new Map();
    this.cacheTTL = 30 * 60 * 1000; // 30 phút
    this.sensitiveRules = []; // Lưu trữ các quy tắc nhạy cảm từ database
    this.loadSensitiveRules(); // Tải các quy tắc nhạy cảm khi khởi tạo
  }

  /**
   * Tải các quy tắc nhạy cảm từ database
   */
  async loadSensitiveRules() {
    try {
      this.sensitiveRules = await db.getSensitiveRules(true);
      console.log(`✅ Loaded ${this.sensitiveRules.length} sensitive rules from database`);
    } catch (error) {
      console.error('Error loading sensitive rules:', error);
      // Nếu lỗi liên quan đến cột không tồn tại, sử dụng mảng rỗng
      this.sensitiveRules = [];
      
      // Thử tải tất cả các quy tắc mà không lọc theo trạng thái active
      try {
        const client = require('../../config/database').pool.connect();
        const result = await (await client).query('SELECT * FROM sensitive_rules');
        this.sensitiveRules = result.rows;
        console.log(`✅ Loaded ${this.sensitiveRules.length} sensitive rules directly from database`);
        (await client).release();
      } catch (dbError) {
        console.error('Error loading sensitive rules directly:', dbError);
      }
    }
  }

  /**
   * Kiểm tra nếu câu hỏi chứa nội dung nhạy cảm
   * @param {string} question - Câu hỏi cần kiểm tra
   * @returns {boolean} Kết quả kiểm tra
   */
  async checkSensitiveContent(question) {
    try {
      // Đảm bảo đã tải quy tắc nhạy cảm
      if (this.sensitiveRules.length === 0) {
        await this.loadSensitiveRules();
      }
      
      // Kiểm tra từng quy tắc
      for (const rule of this.sensitiveRules) {
        try {
          const pattern = new RegExp(rule.pattern, 'i');
          if (pattern.test(question.trim())) {
            console.log(`🚫 Sensitive content detected by rule: ${rule.rule_name}`);
            return true;
          }
        } catch (error) {
          console.error(`Error in regex pattern for rule ${rule.rule_name}:`, error);
        }
      }
      
      // Kiểm tra các từ khóa nhạy cảm ngoài phạm vi công việc
      const nonWorkTopics = [
        /chính trị|đảng|bầu cử|chính phủ|politics|government|election/i,
        /tôn giáo|đạo|tín ngưỡng|religion|faith|god/i,
        /thể thao|bóng đá|bóng rổ|sports|football|soccer|basketball/i,
        /giải trí|phim|ca sĩ|diễn viên|entertainment|movie|singer|actor/i,
        /trò chơi|game|gaming|esport/i
      ];
      
      for (const pattern of nonWorkTopics) {
        if (pattern.test(question.trim())) {
          console.log(`🚫 Non-work related topic detected`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking sensitive content:', error);
      return false;
    }
  }

  /**
   * Hợp nhất dữ liệu từ nhiều nguồn khác nhau để trả lời câu hỏi
   * @param {string} question - Câu hỏi của người dùng
   * @param {Object} analysis - Kết quả phân tích câu hỏi
   * @returns {Object} Dữ liệu đã hợp nhất
   */
  async integrateData(question, analysis) {
    try {
      console.log(`🔄 Integrating data for question: "${question}"`);
      
      // Kiểm tra nếu câu hỏi chứa nội dung nhạy cảm
      const isSensitive = await this.checkSensitiveContent(question);
      if (isSensitive) {
        return {
          documents: [],
          knowledgeEntries: [],
          companyInfo: null,
          departmentInfo: null,
          constraint: {
            answer: "Câu hỏi của bạn có thể chứa nội dung nhạy cảm hoặc nằm ngoài phạm vi công việc. Tôi chỉ có thể trả lời các câu hỏi liên quan đến tài liệu và hoạt động của công ty. Vui lòng đặt câu hỏi khác.",
            confidence: 100
          },
          metadata: {
            sources: ['constraints'],
            isSensitive: true
          }
        };
      }
      
      // Kiểm tra nếu câu hỏi nằm ngoài phạm vi công việc
      if (analysis.intent === 'general_question' && analysis.topic === 'general_knowledge') {
        return {
          documents: [],
          knowledgeEntries: [],
          companyInfo: null,
          departmentInfo: null,
          constraint: {
            answer: "Tôi là trợ lý AI chuyên về tài liệu của công ty. Câu hỏi của bạn nằm ngoài phạm vi dữ liệu của tôi. Tôi được thiết kế để trả lời các câu hỏi về tài liệu, quy định, quy trình của công ty. Vui lòng đặt câu hỏi liên quan đến tài liệu hoặc thông tin công ty để tôi có thể hỗ trợ tốt hơn.",
            confidence: 95
          },
          metadata: {
            sources: ['constraints'],
            isOutOfScope: true
          }
        };
      }
      
      // Xác định các nguồn dữ liệu cần truy vấn
      const dataSources = this.determineDataSources(analysis);
      
      // Truy vấn dữ liệu từ nhiều nguồn song song
      const dataPromises = dataSources.map(source => this.fetchDataFromSource(source, question, analysis));
      const dataResults = await Promise.all(dataPromises);
      
      // Hợp nhất kết quả
      const integratedData = this.mergeResults(dataResults, analysis);
      
      return integratedData;
    } catch (error) {
      console.error('Error integrating data:', error);
      return {
        documents: [],
        knowledgeEntries: [],
        companyInfo: null,
        departmentInfo: null,
        metadata: {}
      };
    }
  }

  /**
   * Xác định các nguồn dữ liệu cần truy vấn
   * @param {Object} analysis - Kết quả phân tích câu hỏi
   * @returns {Array<string>} Danh sách các nguồn dữ liệu
   */
  determineDataSources(analysis) {
    const sources = [];
    
    switch (analysis.source) {
      case 'documents':
        sources.push('documents');
        break;
        
      case 'knowledge':
        sources.push('knowledge_base');
        break;
        
      case 'hybrid':
        sources.push('documents', 'knowledge_base');
        break;
        
      case 'constraints':
        sources.push('constraints');
        break;
        
      default:
        sources.push('constraints');
    }
    
    // Thêm nguồn dữ liệu về công ty nếu có
    if (analysis.company) {
      sources.push('companies');
    }
    
    // Thêm nguồn dữ liệu về phòng ban nếu có
    if (analysis.department) {
      sources.push('departments');
    }
    
    return sources;
  }

  /**
   * Truy vấn dữ liệu từ một nguồn cụ thể
   * @param {string} source - Nguồn dữ liệu
   * @param {string} question - Câu hỏi của người dùng
   * @param {Object} analysis - Kết quả phân tích câu hỏi
   * @returns {Object} Dữ liệu từ nguồn
   */
  async fetchDataFromSource(source, question, analysis) {
    try {
      const cacheKey = `${source}:${question}`;
      
      // Kiểm tra cache
      if (this.dataCache.has(cacheKey)) {
        const cachedData = this.dataCache.get(cacheKey);
        if (Date.now() - cachedData.timestamp < this.cacheTTL) {
          console.log(`🔍 Using cached data for ${source}`);
          return { source, data: cachedData.data };
        }
      }
      
      console.log(`🔍 Fetching data from ${source}`);
      
      let data = null;
      
      switch (source) {
        case 'documents':
          data = await this.fetchDocuments(question, analysis);
          break;
          
        case 'knowledge_base':
          data = await this.fetchKnowledgeBase(question, analysis);
          break;
          
        case 'companies':
          data = await this.fetchCompanyInfo(analysis.company);
          break;
          
        case 'departments':
          data = await this.fetchDepartmentInfo(analysis.department, analysis.company);
          break;
          
        case 'constraints':
          data = await this.fetchConstraints(question);
          break;
          
        default:
          data = null;
      }
      
      // Lưu vào cache
      this.dataCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return { source, data };
    } catch (error) {
      console.error(`Error fetching data from ${source}:`, error);
      return { source, data: null, error: error.message };
    }
  }

  /**
   * Truy vấn dữ liệu từ tài liệu
   * @param {string} question - Câu hỏi của người dùng
   * @param {Object} analysis - Kết quả phân tích câu hỏi
   * @returns {Array} Danh sách tài liệu liên quan
   */
  async fetchDocuments(question, analysis) {
    try {
      // Xử lý đặc biệt cho câu hỏi danh sách tài liệu theo công ty
      if (analysis.intent === 'list_documents' && analysis.company) {
        console.log(`📑 Fetching document list for company: ${analysis.company}`);
        return await db.getDocumentsByCompany(analysis.company);
      }
      
      // Tìm kiếm tài liệu với các bộ lọc
      const filters = {};
      
      // Lọc theo công ty
      if (analysis.company) {
        filters.companyId = analysis.company;
      }
      
      // Lọc theo phòng ban (nếu có)
      if (analysis.department) {
        filters.department = analysis.department;
      }
      
      // Lọc theo chủ đề (nếu có)
      if (analysis.topic) {
        filters.category = analysis.topic;
      }
      
      // Thực hiện tìm kiếm
      const documents = await db.searchDocuments(question, filters);
      
      return documents;
    } catch (error) {
      console.error('Error fetching documents:', error);
      return [];
    }
  }

  /**
   * Truy vấn dữ liệu từ knowledge base
   * @param {string} question - Câu hỏi của người dùng
   * @param {Object} analysis - Kết quả phân tích câu hỏi
   * @returns {Array} Danh sách knowledge entries liên quan
   */
  async fetchKnowledgeBase(question, analysis) {
    try {
      // Tìm kiếm trong knowledge base
      const knowledgeEntries = await db.searchKnowledgeBase(question);
      
      // Lọc theo công ty nếu có
      if (analysis.company && knowledgeEntries.length > 0) {
        return knowledgeEntries.filter(entry => 
          !entry.company_id || entry.company_id === analysis.company
        );
      }
      
      return knowledgeEntries;
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
      return [];
    }
  }

  /**
   * Truy vấn thông tin công ty
   * @param {string} companyCode - Mã công ty
   * @returns {Object} Thông tin công ty
   */
  async fetchCompanyInfo(companyCode) {
    try {
      if (!companyCode) return null;
      
      // Tìm công ty theo mã
      const companies = await db.getCompanies();
      return companies.find(company => company.code === companyCode) || null;
    } catch (error) {
      console.error('Error fetching company info:', error);
      return null;
    }
  }

  /**
   * Truy vấn thông tin phòng ban
   * @param {string} department - Tên phòng ban
   * @param {string} companyCode - Mã công ty
   * @returns {Object} Thông tin phòng ban
   */
  async fetchDepartmentInfo(department, companyCode) {
    try {
      if (!department) return null;
      
      // Tìm thông tin phòng ban
      const departmentInfo = await db.getDepartmentInfo(department, companyCode);
      return departmentInfo;
    } catch (error) {
      console.error('Error fetching department info:', error);
      return null;
    }
  }

  /**
   * Truy vấn dữ liệu từ constraints
   * @param {string} question - Câu hỏi của người dùng
   * @returns {Object} Thông tin constraints
   */
  async fetchConstraints(question) {
    try {
      // Lấy tất cả constraints
      const constraints = await db.getConstraints();
      
      // Tìm constraint phù hợp
      for (const constraint of constraints) {
        if (this.matchConstraint(question, constraint.question)) {
          return constraint;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching constraints:', error);
      return null;
    }
  }

  /**
   * Kiểm tra xem câu hỏi có khớp với constraint không
   * @param {string} question - Câu hỏi của người dùng
   * @param {string} constraintQuestion - Câu hỏi trong constraint
   * @returns {boolean} Kết quả so khớp
   */
  matchConstraint(question, constraintQuestion) {
    const questionLower = question.toLowerCase().trim();
    const constraintLower = constraintQuestion.toLowerCase().trim();
    
    // Kiểm tra khớp chính xác
    if (questionLower === constraintLower) {
      return true;
    }
    
    // Kiểm tra khớp mờ
    const questionWords = questionLower.split(/\s+/);
    const constraintWords = constraintLower.split(/\s+/);
    
    let matchCount = 0;
    for (const word of questionWords) {
      if (word.length > 2 && constraintWords.includes(word)) {
        matchCount++;
      }
    }
    
    // Nếu đủ số từ khớp, coi là match
    return matchCount >= Math.min(2, questionWords.length - 1);
  }

  /**
   * Hợp nhất kết quả từ các nguồn dữ liệu
   * @param {Array} dataResults - Kết quả từ các nguồn dữ liệu
   * @param {Object} analysis - Kết quả phân tích câu hỏi
   * @returns {Object} Dữ liệu đã hợp nhất
   */
  mergeResults(dataResults, analysis) {
    const result = {
      documents: [],
      knowledgeEntries: [],
      companyInfo: null,
      departmentInfo: null,
      constraint: null,
      metadata: {
        sources: [],
        analysisResult: analysis
      }
    };
    
    // Hợp nhất dữ liệu từ các nguồn
    for (const { source, data, error } of dataResults) {
      if (error) {
        result.metadata.errors = result.metadata.errors || {};
        result.metadata.errors[source] = error;
        continue;
      }
      
      if (!data) continue;
      
      result.metadata.sources.push(source);
      
      switch (source) {
        case 'documents':
          result.documents = data;
          break;
          
        case 'knowledge_base':
          result.knowledgeEntries = data;
          break;
          
        case 'companies':
          result.companyInfo = data;
          break;
          
        case 'departments':
          result.departmentInfo = data;
          break;
          
        case 'constraints':
          result.constraint = data;
          break;
      }
    }
    
    // Xử lý đặc biệt cho câu hỏi danh sách tài liệu theo công ty
    if (analysis.intent === 'list_documents' && result.documents.length > 0) {
      const company = result.companyInfo ? result.companyInfo.name : analysis.company;
      let documentList = '';
      
      if (result.documents.length > 0) {
        documentList = result.documents.map((doc, index) => 
          `${index + 1}. ${doc.original_name} (${doc.category || 'Chưa phân loại'})`
        ).join('\n');
        
        result.constraint = {
          answer: `Danh sách tài liệu thuộc ${company}:\n\n${documentList}`,
          confidence: 100
        };
      } else {
        result.constraint = {
          answer: `Hiện tại chưa có quy định hoặc quy trình nào được upload cho ${company}. Vui lòng upload tài liệu để có thể trả lời câu hỏi này.`,
          confidence: 100
        };
      }
    }
    
    return result;
  }

  /**
   * Xóa cache
   */
  clearCache() {
    this.dataCache.clear();
    console.log('🧹 Data cache cleared');
  }
}

module.exports = DataIntegrationService; 