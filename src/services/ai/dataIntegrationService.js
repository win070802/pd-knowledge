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
      this.sensitiveRules = [];
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
   * Truy vấn dữ liệu từ document_metadata
   * @param {string} question - Câu hỏi của người dùng
   * @param {Object} analysis - Kết quả phân tích câu hỏi
   * @returns {Array} Danh sách tài liệu liên quan
   */
  async fetchDocuments(question, analysis) {
    try {
      // Xử lý đặc biệt cho câu hỏi danh sách tài liệu theo công ty
      if (analysis.intent === 'list_documents') {
        console.log(`📑 Fetching document list for intent: list_documents`);
        const { pool } = require('../../config/database');
        const client = await pool.connect();
        
        try {
          // Kiểm tra nếu câu hỏi yêu cầu tất cả tài liệu của tập đoàn
          const isAllCompaniesRequest = 
            question.toLowerCase().includes('tất cả') || 
            question.toLowerCase().includes('toàn bộ') ||
            question.toLowerCase().includes('tập đoàn') ||
            question.toLowerCase().includes('mọi công ty') ||
            question.toLowerCase().includes('các công ty');
            
          // Nếu là yêu cầu tất cả tài liệu của tập đoàn
          if (isAllCompaniesRequest) {
            console.log(`📑 Fetching documents for all companies`);
            
            // Lấy tất cả tài liệu và thông tin công ty
            const result = await client.query(`
              SELECT d.*, c.company_code as company_code, c.company_name as company_name 
              FROM document_metadata d 
              JOIN companies c ON d.company_id = c.id 
              ORDER BY c.company_name, d.date_created DESC
            `);
            
            return result.rows;
          }
          // Nếu có công ty cụ thể
          else if (analysis.company) {
            console.log(`📑 Fetching document list for company: ${analysis.company}`);
            
            // Trước tiên lấy thông tin công ty
            const companyResult = await client.query(`
              SELECT * FROM companies 
              WHERE UPPER(company_code) = UPPER($1)
            `, [analysis.company]);
            
            if (companyResult.rows.length === 0) {
              console.log(`⚠️ Company with code "${analysis.company}" not found`);
              return [];
            }
            
            const company = companyResult.rows[0];
            
            // Sau đó lấy tài liệu của công ty đó
            const result = await client.query(`
              SELECT d.*, c.company_code as company_code, c.company_name as company_name 
              FROM document_metadata d 
              JOIN companies c ON d.company_id = c.id 
              WHERE c.id = $1 
              ORDER BY d.date_created DESC
            `, [company.id]);
            
            return result.rows;
          }
          // Nếu không có công ty cụ thể và không phải yêu cầu tất cả
          else {
            // Thử tìm công ty từ ngữ cảnh câu hỏi
            const questionLower = question.toLowerCase();
            const companyResult = await client.query(`SELECT * FROM companies`);
            let detectedCompany = null;
            
            // Tìm công ty từ câu hỏi
            for (const company of companyResult.rows) {
              if (company.company_name && questionLower.includes(company.company_name.toLowerCase())) {
                detectedCompany = company;
                break;
              }
              
              if (company.company_code && questionLower.includes(company.company_code.toLowerCase())) {
                detectedCompany = company;
                break;
              }
            }
            
            // Nếu tìm thấy công ty
            if (detectedCompany) {
              console.log(`📑 Detected company from question: ${detectedCompany.company_code}`);
              
              const result = await client.query(`
                SELECT d.*, c.company_code as company_code, c.company_name as company_name 
                FROM document_metadata d 
                JOIN companies c ON d.company_id = c.id 
                WHERE c.id = $1 
                ORDER BY d.date_created DESC
              `, [detectedCompany.id]);
              
              return result.rows;
            }
            // Mặc định lấy tất cả tài liệu
            else {
              console.log(`📑 No specific company detected, fetching all documents`);
              
              const result = await client.query(`
                SELECT d.*, c.company_code as company_code, c.company_name as company_name 
                FROM document_metadata d 
                JOIN companies c ON d.company_id = c.id 
                ORDER BY d.date_created DESC
                LIMIT 20
              `);
              
              return result.rows;
            }
          }
        } finally {
          client.release();
        }
      }
      
      // Tìm kiếm tài liệu với các bộ lọc
      const filters = {};
      
      // Lọc theo công ty
      if (analysis.company) {
        // Lấy ID công ty từ mã công ty
        const { pool } = require('../../config/database');
        const companyClient = await pool.connect();
        try {
          const companyResult = await companyClient.query(`
            SELECT id FROM companies 
            WHERE UPPER(company_code) = UPPER($1)
          `, [analysis.company]);
          
          if (companyResult.rows.length > 0) {
            filters.company_id = companyResult.rows[0].id;
          }
        } finally {
          companyClient.release();
        }
      }
      
      // Lọc theo phòng ban (nếu có)
      if (analysis.department) {
        filters.department = analysis.department;
      }
      
      // Lọc theo chủ đề (nếu có)
      if (analysis.topic) {
        filters.dc_type = analysis.topic;
      }
      
      // Thực hiện tìm kiếm trong document_metadata
      const { pool } = require('../../config/database');
      const client = await pool.connect();
      try {
        // Chuẩn bị từ khóa tìm kiếm
        const searchPattern = `%${question.toLowerCase().replace(/\s+/g, '%')}%`;
        
        // Xây dựng câu truy vấn động với các bộ lọc
        let query = `
          SELECT * FROM document_metadata 
          WHERE (LOWER(dc_title) LIKE $1 OR 
                LOWER(dc_description) LIKE $1 OR
                LOWER(document_summary) LIKE $1 OR
                extracted_text LIKE $1)
        `;
        
        const queryParams = [searchPattern];
        let paramIndex = 2;
        
        // Thêm các điều kiện lọc
        if (filters.company_id) {
          query += ` AND company_id = $${paramIndex}`;
          queryParams.push(filters.company_id);
          paramIndex++;
        }
        
        if (filters.department) {
          query += ` AND department = $${paramIndex}`;
          queryParams.push(filters.department);
          paramIndex++;
        }
        
        if (filters.dc_type) {
          query += ` AND dc_type = $${paramIndex}`;
          queryParams.push(filters.dc_type);
          paramIndex++;
        }
        
        // Thêm sắp xếp và giới hạn
        query += ` ORDER BY date_created DESC LIMIT 5`;
        
        const result = await client.query(query, queryParams);
        return result.rows;
      } finally {
        client.release();
      }
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
      const { pool } = require('../../config/database');
      const client = await pool.connect();
      
      try {
        console.log(`🔍 Searching knowledge_base for: "${question}"`);
        
        // Chuẩn bị pattern tìm kiếm
        const searchWords = question.toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 3)
          .map(word => `%${word}%`);
        
        if (searchWords.length === 0) {
          searchWords.push(`%${question.toLowerCase()}%`);
        }
        
        // Tạo query với nhiều điều kiện OR
        let query = `
          SELECT kb.*, c.company_code 
          FROM knowledge_base kb
          LEFT JOIN companies c ON kb.company_id = c.id
          WHERE kb.is_active = true AND (
        `;
        
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        
        // Tạo điều kiện tìm kiếm cho mỗi từ
        for (const word of searchWords) {
          conditions.push(`LOWER(kb.question) LIKE $${paramIndex} OR LOWER(kb.answer) LIKE $${paramIndex}`);
          params.push(word);
          paramIndex++;
        }
        
        query += conditions.join(' OR ') + ')';
        
        // Thêm điều kiện lọc theo công ty nếu có
        if (analysis.company) {
          query += ` AND (c.company_code = $${paramIndex} OR kb.company_id IS NULL)`;
          params.push(analysis.company);
          paramIndex++;
        }
        
        // Giới hạn kết quả và sắp xếp
        query += ` ORDER BY 
          CASE WHEN kb.company_id IS NOT NULL THEN 0 ELSE 1 END, 
          kb.created_at DESC 
          LIMIT 10`;
        
        console.log(`📝 Executing query: ${query}`);
        console.log(`📝 With params: ${params.join(', ')}`);
        
        const result = await client.query(query, params);
        console.log(`📚 Found ${result.rows.length} knowledge entries`);
        
        return result.rows;
      } finally {
        client.release();
      }
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
      
      const { pool } = require('../../config/database');
      const client = await pool.connect();
      
      try {
        console.log(`🔍 Fetching company info for code: "${companyCode}"`);
        
        const query = `
          SELECT * FROM companies 
          WHERE UPPER(company_code) = UPPER($1)
        `;
        
        const result = await client.query(query, [companyCode]);
        
        if (result.rows.length > 0) {
          console.log(`✅ Found company: ${result.rows[0].company_name}`);
          return result.rows[0];
        } else {
          console.log(`⚠️ Company with code "${companyCode}" not found`);
          return null;
        }
      } finally {
        client.release();
      }
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
      
      const { pool } = require('../../config/database');
      const client = await pool.connect();
      
      try {
        console.log(`🔍 Fetching department info for: "${department}" in company "${companyCode || 'any'}"`);
        
        let query = '';
        let params = [];
        
        if (companyCode) {
          // Tìm phòng ban trong công ty cụ thể
          query = `
            SELECT c.id as company_id, c.company_code, c.company_name, 
                   c.departments->>$1 as department_info
            FROM companies c
            WHERE UPPER(c.company_code) = UPPER($2)
            AND c.departments ? $1
          `;
          params = [department, companyCode];
        } else {
          // Tìm phòng ban trong tất cả các công ty
          query = `
            SELECT c.id as company_id, c.company_code, c.company_name, 
                   c.departments->>$1 as department_info
            FROM companies c
            WHERE c.departments ? $1
            LIMIT 1
          `;
          params = [department];
        }
        
        const result = await client.query(query, params);
        
        if (result.rows.length > 0) {
          const row = result.rows[0];
          let departmentInfo = null;
          
          try {
            departmentInfo = JSON.parse(row.department_info);
          } catch (e) {
            departmentInfo = { name: row.department_info };
          }
          
          const info = {
            name: departmentInfo.name || department,
            code: departmentInfo.code || department,
            head: departmentInfo.head,
            company: {
              id: row.company_id,
              code: row.company_code,
              name: row.company_name
            }
          };
          
          console.log(`✅ Found department: ${info.name} in ${info.company.name}`);
          return info;
        } else {
          console.log(`⚠️ Department "${department}" not found`);
          return null;
        }
      } finally {
        client.release();
      }
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
      const { pool } = require('../../config/database');
      const client = await pool.connect();
      
      try {
        console.log(`🔍 Checking constraints for question: "${question}"`);
        
      // Lấy tất cả constraints
        const query = `
          SELECT * FROM constraints 
          WHERE is_active = true
        `;
        
        const result = await client.query(query);
        const constraints = result.rows;
      
      // Tìm constraint phù hợp
      for (const constraint of constraints) {
        if (this.matchConstraint(question, constraint.question)) {
            console.log(`✅ Found matching constraint: "${constraint.question}"`);
          return constraint;
        }
      }
      
        console.log('⚠️ No matching constraint found');
      return null;
      } finally {
        client.release();
      }
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
    if (analysis.intent === 'list_documents' && result.documents.length >= 0) {
      // Kiểm tra xem là yêu cầu tất cả tài liệu hay chỉ của một công ty
      const isAllCompaniesRequest = 
        analysis.company === null && 
        (result.documents.length > 0 && result.documents.some(doc => doc.company_code !== result.documents[0].company_code));
      
      if (isAllCompaniesRequest) {
        // Nhóm tài liệu theo công ty
        const documentsByCompany = {};
        
        for (const doc of result.documents) {
          const companyCode = doc.company_code || 'unknown';
          const companyName = doc.company_name || 'Không xác định';
          
          if (!documentsByCompany[companyCode]) {
            documentsByCompany[companyCode] = {
              name: companyName,
              documents: []
            };
          }
          
          documentsByCompany[companyCode].documents.push(doc);
        }
        
        // Tạo danh sách tài liệu theo công ty
        if (Object.keys(documentsByCompany).length > 0) {
          let documentList = '';
          
          for (const [companyCode, company] of Object.entries(documentsByCompany)) {
            documentList += `\n\n## ${company.name} (${companyCode})\n`;
            
            if (company.documents.length > 0) {
              company.documents.forEach((doc, index) => {
                documentList += `${index + 1}. ${doc.dc_title || doc.original_name || 'Tài liệu không tên'} (${doc.dc_type || doc.category || 'Chưa phân loại'})\n`;
              });
            } else {
              documentList += `Không có tài liệu\n`;
            }
          }
          
          result.constraint = {
            answer: `Danh sách tài liệu của tất cả công ty trong tập đoàn:${documentList}`,
            confidence: 100
          };
        } else {
          result.constraint = {
            answer: `Hiện tại chưa có tài liệu nào được upload cho các công ty trong tập đoàn. Vui lòng upload tài liệu để có thể trả lời câu hỏi này.`,
            confidence: 100
          };
        }
      } else {
        // Lấy tên công ty từ thông tin công ty hoặc từ tài liệu
        let companyName = "không xác định";
        
        if (result.companyInfo) {
          companyName = result.companyInfo.company_name;
        } else if (result.documents.length > 0 && result.documents[0].company_name) {
          companyName = result.documents[0].company_name;
        } else if (analysis.company) {
          companyName = analysis.company;
        }
        
        if (result.documents.length > 0) {
          const documentList = result.documents.map((doc, index) => 
            `${index + 1}. ${doc.dc_title || doc.original_name || 'Tài liệu không tên'} (${doc.dc_type || doc.category || 'Chưa phân loại'})`
          ).join('\n');
          
          result.constraint = {
            answer: `Danh sách tài liệu thuộc ${companyName}:\n\n${documentList}`,
            confidence: 100
          };
        } else {
          result.constraint = {
            answer: `Hiện tại chưa có tài liệu nào được upload cho ${companyName}. Vui lòng upload tài liệu để có thể trả lời câu hỏi này.`,
            confidence: 100
          };
        }
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