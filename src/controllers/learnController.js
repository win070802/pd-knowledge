const { db } = require('../../database');

// Learn from free text input
const learnFromText = async (req, res) => {
  try {
    const { 
      text, 
      companyCode, 
      category, 
      question, 
      answer,
      keywords 
    } = req.body;

    if (!text && !(question && answer)) {
      return res.status(400).json({
        error: 'Either "text" or both "question" and "answer" are required'
      });
    }

    let company = null;
    if (companyCode) {
      company = await db.getCompanyByCode(companyCode.toUpperCase());
      if (!company) {
        return res.status(400).json({
          error: `Company with code "${companyCode}" not found. Valid codes: PDH, PDI, PDE, PDHH, RH`
        });
      }
    }

    let finalQuestion, finalAnswer, finalKeywords;

    if (text) {
      // Process free text - AI will extract Q&A from it
      finalQuestion = `Kiến thức về ${companyCode || 'công ty'}`;
      finalAnswer = text;
      finalKeywords = extractKeywords(text);
    } else {
      // Direct Q&A input
      finalQuestion = question;
      finalAnswer = answer;
      finalKeywords = keywords || extractKeywords(question + ' ' + answer);
    }

    // Save to knowledge base
    const knowledge = await db.createKnowledge({
      companyId: company ? company.id : null,
      question: finalQuestion,
      answer: finalAnswer,
      keywords: finalKeywords,
      category: category || 'General',
      isActive: true
    });

    console.log(`📚 New knowledge added: ${finalQuestion.substring(0, 50)}...`);

    res.status(201).json({
      success: true,
      message: 'Knowledge successfully added to AI learning base',
      knowledge: {
        id: knowledge.id,
        company: company ? company.code : null,
        question: finalQuestion,
        category: category || 'General',
        keywordsCount: finalKeywords.length
      }
    });

  } catch (error) {
    console.error('Error in learn API:', error);
    res.status(500).json({
      error: 'Failed to add knowledge',
      details: error.message
    });
  }
};

// Get learned knowledge
const getKnowledge = async (req, res) => {
  try {
    const { companyCode, category, limit = 50 } = req.query;
    console.log(`🔍 Getting knowledge for: companyCode=${companyCode}, category=${category}, limit=${limit}`);
    
    let filters = { isActive: true };
    
    if (companyCode) {
      const company = await db.getCompanyByCode(companyCode.toUpperCase());
      console.log(`📊 Found company:`, company);
      if (company) {
        filters.companyId = company.id;
      }
    }
    
    if (category) {
      filters.category = category;
    }

    console.log(`🎯 Final filters:`, filters);
    
    // Get knowledge directly from database
    const knowledge = await getKnowledgeWithCompany(filters, limit);
    console.log(`📚 Retrieved ${knowledge.length} knowledge entries`);

    res.json({
      success: true,
      count: knowledge.length,
      knowledge: knowledge.map(k => ({
        id: k.id,
        company: k.company_code || null,
        question: k.question,
        answer: k.answer.substring(0, 200) + (k.answer.length > 200 ? '...' : ''),
        category: k.category,
        keywords: k.keywords,
        createdAt: k.created_at
      }))
    });

  } catch (error) {
    console.error('Error getting knowledge:', error);
    res.status(500).json({
      error: 'Failed to retrieve knowledge',
      details: error.message
    });
  }
};

// Get knowledge with company information
async function getKnowledgeWithCompany(filters, limit) {
  const { pool } = require('../config/database');
  const client = await pool.connect();
  
  try {
    let query = `
      SELECT kb.*, c.code as company_code 
      FROM knowledge_base kb 
      LEFT JOIN companies c ON kb.company_id = c.id 
      WHERE kb.is_active = true
    `;
    const params = [];
    let paramCount = 0;
    
    if (filters.companyId) {
      paramCount++;
      query += ` AND kb.company_id = $${paramCount}`;
      params.push(filters.companyId);
    }
    
    if (filters.category) {
      paramCount++;
      query += ` AND kb.category = $${paramCount}`;
      params.push(filters.category);
    }
    
    query += ` ORDER BY kb.created_at DESC LIMIT $${paramCount + 1}`;
    params.push(limit);
    
    console.log(`🔎 Executing query:`, query);
    console.log(`📋 With params:`, params);
    
    const result = await client.query(query, params);
    console.log(`📊 Query result: ${result.rows.length} rows`);
    return result.rows;
  } catch (error) {
    console.error('❌ Error in getKnowledgeWithCompany:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Extract keywords from text (simple implementation)
function extractKeywords(text) {
  if (!text) return [];
  
  const vietnameseStopWords = [
    'và', 'của', 'trong', 'với', 'cho', 'về', 'từ', 'khi', 'đến', 'có', 'là', 'một', 
    'các', 'những', 'này', 'đó', 'được', 'sẽ', 'để', 'theo', 'như', 'trên', 'dưới'
  ];
  
  const words = text.toLowerCase()
    .replace(/[^\w\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !vietnameseStopWords.includes(word) &&
      !word.match(/^\d+$/)
    );
  
  // Get unique words and limit to 10
  return [...new Set(words)].slice(0, 10);
}

module.exports = {
  learnFromText,
  getKnowledge
}; 