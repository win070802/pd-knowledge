const { db } = require('../../database');
const { pool } = require('../config/database');

// Lấy tất cả knowledge theo công ty
const getKnowledgeByCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Kiểm tra companyId có phải UUID không
    const isValidUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(companyId);
    
    if (!isValidUUID) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid company ID format' 
      });
    }
    
    const result = await pool.query(
      `SELECT * FROM knowledge_base WHERE company_id = $1 AND is_active = TRUE ORDER BY created_at DESC`,
      [companyId]
    );
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting knowledge by company:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Tìm kiếm knowledge
const searchKnowledge = async (req, res) => {
  try {
    const { q, companyId, category } = req.query;
    
    let query = `SELECT * FROM knowledge_base WHERE is_active = TRUE`;
    const params = [];
    
    // Thêm điều kiện tìm kiếm
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      query += ` AND (LOWER(question) LIKE $${params.length} OR LOWER(answer) LIKE $${params.length})`;
    }
    
    // Lọc theo công ty
    if (companyId) {
      params.push(companyId);
      query += ` AND company_id = $${params.length}`;
    }
    
    // Lọc theo danh mục
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    
    // Sắp xếp kết quả
    query += ` ORDER BY created_at DESC`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error searching knowledge:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Tạo knowledge mới
const createKnowledge = async (req, res) => {
  try {
    const { 
      question, 
      answer, 
      company_id, 
      keywords, 
      category,
      is_active,
      metadata 
    } = req.body;
    
    // Validate dữ liệu đầu vào
    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        error: 'Question and answer are required'
      });
    }
    
    // Kiểm tra companyId có hợp lệ không
    if (company_id) {
      const companyExists = await pool.query('SELECT id FROM companies WHERE id = $1', [company_id]);
      if (companyExists.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Company not found'
        });
      }
    }
    
    // Tạo knowledge mới
    const result = await pool.query(
      `INSERT INTO knowledge_base (
        question, 
        answer, 
        company_id, 
        keywords, 
        category, 
        is_active, 
        metadata,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        question, 
        answer, 
        company_id || null, 
        keywords || null, 
        category || null, 
        is_active !== undefined ? is_active : true,
        metadata || null,
        req.user ? req.user.username : 'system'
      ]
    );
    
    res.status(201).json({
      success: true,
      message: 'Knowledge created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating knowledge:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Cập nhật knowledge
const updateKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      question, 
      answer, 
      company_id, 
      keywords, 
      category,
      is_active,
      metadata 
    } = req.body;
    
    // Kiểm tra knowledge tồn tại không
    const knowledgeExists = await pool.query('SELECT id FROM knowledge_base WHERE id = $1', [id]);
    if (knowledgeExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge not found'
      });
    }
    
    // Validate dữ liệu đầu vào
    if ((!question && !answer && !company_id && !keywords && !category && is_active === undefined && !metadata)) {
      return res.status(400).json({
        success: false,
        error: 'No data provided for update'
      });
    }
    
    // Kiểm tra companyId có hợp lệ không
    if (company_id) {
      const companyExists = await pool.query('SELECT id FROM companies WHERE id = $1', [company_id]);
      if (companyExists.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Company not found'
        });
      }
    }
    
    // Lấy dữ liệu hiện tại
    const currentKnowledge = await pool.query('SELECT * FROM knowledge_base WHERE id = $1', [id]);
    const current = currentKnowledge.rows[0];
    
    // Cập nhật knowledge
    const result = await pool.query(
      `UPDATE knowledge_base SET
        question = $1,
        answer = $2,
        company_id = $3,
        keywords = $4,
        category = $5,
        is_active = $6,
        metadata = $7,
        updated_by = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 RETURNING *`,
      [
        question || current.question,
        answer || current.answer,
        company_id !== undefined ? company_id : current.company_id,
        keywords || current.keywords,
        category || current.category,
        is_active !== undefined ? is_active : current.is_active,
        metadata || current.metadata,
        req.user ? req.user.username : 'system',
        id
      ]
    );
    
    res.json({
      success: true,
      message: 'Knowledge updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating knowledge:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Xóa knowledge
const deleteKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Kiểm tra knowledge tồn tại không
    const knowledgeExists = await pool.query('SELECT id FROM knowledge_base WHERE id = $1', [id]);
    if (knowledgeExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge not found'
      });
    }
    
    // Xóa knowledge
    await pool.query('DELETE FROM knowledge_base WHERE id = $1', [id]);
    
    res.json({
      success: true,
      message: 'Knowledge deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting knowledge:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Lấy knowledge theo ID
const getKnowledgeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM knowledge_base WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Knowledge not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting knowledge by id:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Tạo knowledge từ document
const createKnowledgeFromDocument = async (documentId, companyId) => {
  try {
    // Lấy thông tin document
    const document = await db.getDocumentById(documentId);
    if (!document) {
      throw new Error(`Document with ID ${documentId} not found`);
    }
    
    // Lấy thông tin công ty
    let company = null;
    if (companyId) {
      const companyResult = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
      if (companyResult.rows.length > 0) {
        company = companyResult.rows[0];
      }
    }
    
    // Kiểm tra metadata của document
    if (!document.metadata || !document.metadata.structureAnalysis) {
      console.log(`Document ${documentId} does not have structureAnalysis metadata`);
      return null;
    }
    
    const { structureAnalysis } = document.metadata;
    
    // Kiểm tra xem có câu hỏi và câu trả lời không
    if (!structureAnalysis.canAnswerQuestions || structureAnalysis.canAnswerQuestions.length === 0) {
      console.log(`Document ${documentId} does not have any questions`);
      return null;
    }
    
    // Tạo knowledge entries từ các câu hỏi và câu trả lời
    const knowledgeEntries = [];
    
    for (const question of structureAnalysis.canAnswerQuestions) {
      // Tìm câu trả lời trong nội dung document
      const answer = await extractAnswerFromDocument(document, question);
      
      if (answer) {
        // Tạo knowledge entry
        const result = await pool.query(
          `INSERT INTO knowledge_base (
            question,
            answer,
            company_id,
            keywords,
            category,
            is_active,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            question,
            answer,
            companyId,
            structureAnalysis.keyTerms || [],
            document.category || 'General',
            true,
            {
              sourceDocumentId: document.id,
              sourceDocumentName: document.original_name,
              extractionMethod: 'AI',
              extractionDate: new Date().toISOString(),
              confidence: 0.8
            }
          ]
        );
        
        knowledgeEntries.push(result.rows[0]);
      }
    }
    
    return knowledgeEntries;
  } catch (error) {
    console.error('Error creating knowledge from document:', error);
    throw error;
  }
};

// Hàm trích xuất câu trả lời từ document
async function extractAnswerFromDocument(document, question) {
  try {
    // Kiểm tra xem document có nội dung không
    if (!document.content_text) {
      return null;
    }
    
    // Sử dụng AI để trích xuất câu trả lời
    // Trong trường hợp này, chúng ta sẽ giả lập bằng cách tìm đoạn văn bản liên quan
    
    // Tìm đoạn văn bản liên quan đến câu hỏi
    const keywords = question.toLowerCase().split(' ')
      .filter(word => word.length > 3)
      .filter(word => !['what', 'when', 'where', 'who', 'why', 'how', 'is', 'are', 'was', 'were', 'will', 'would', 'should', 'could', 'can'].includes(word));
    
    // Chia nội dung thành các đoạn
    const paragraphs = document.content_text.split('\n\n');
    
    // Tìm đoạn phù hợp nhất
    let bestParagraph = '';
    let bestScore = 0;
    
    for (const paragraph of paragraphs) {
      if (paragraph.length < 20) continue; // Bỏ qua đoạn quá ngắn
      
      let score = 0;
      const lowerParagraph = paragraph.toLowerCase();
      
      // Tính điểm dựa trên số từ khóa xuất hiện
      for (const keyword of keywords) {
        if (lowerParagraph.includes(keyword)) {
          score += 1;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestParagraph = paragraph;
      }
    }
    
    // Nếu không tìm thấy đoạn phù hợp
    if (bestScore === 0) {
      return null;
    }
    
    return bestParagraph;
  } catch (error) {
    console.error('Error extracting answer from document:', error);
    return null;
  }
}

module.exports = {
  getKnowledgeByCompany,
  searchKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  getKnowledgeById,
  createKnowledgeFromDocument
}; 