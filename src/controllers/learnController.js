const { db } = require('../../database');
const { pool } = require('../config/database');
const storageService = require('../../storage-service');

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

// Learn document-company mapping and reorganize file
const learnDocumentCompany = async (req, res) => {
  try {
    const { 
      documentId,
      filename, 
      companyCode,
      pattern // Optional: specific pattern to learn
    } = req.body;

    if (!companyCode) {
      return res.status(400).json({
        success: false,
        error: 'Company code is required'
      });
    }

    // Validate company
    const company = await db.getCompanyByCode(companyCode.toUpperCase());
    if (!company) {
      return res.status(400).json({
        success: false,
        error: `Company with code "${companyCode}" not found. Valid codes: PDH, PDI`
      });
    }

    let document = null;

    // Find document by ID or filename
    if (documentId) {
      document = await db.getDocumentById(documentId);
    } else if (filename) {
      // Find document by original filename
      const documents = await db.getDocuments();
      document = documents.find(doc => 
        doc.original_name === filename || 
        doc.original_name.includes(filename) ||
        filename.includes(doc.original_name)
      );
    }

    if (!document) {
      return res.status(404).json({
        success: false,
        error: `Document not found. Available documents: ${documentId ? 'Check document ID' : 'Check filename'}`
      });
    }

    console.log(`📚 Learning: Document "${document.original_name}" belongs to ${company.code}`);

    // Reorganize file if currently in UNKNOWN folder
    let reorganizeResult = null;
    if (!document.company_id || document.metadata?.companyCode === 'UNKNOWN') {
      
      console.log(`🔄 Reorganizing document from UNKNOWN to ${company.code}`);
      
      reorganizeResult = await storageService.reorganizeFileByCompany(
        document.file_path,
        document.filename,
        company,
        document.category
      );

      if (reorganizeResult) {
        // Update document in database
        await db.updateDocument(document.id, {
          company_id: company.id,
          file_path: reorganizeResult.path,
          metadata: {
            ...document.metadata,
            companyCode: company.code,
            storageUrl: reorganizeResult.url,
            reorganizedAt: new Date().toISOString(),
            reorganizedFrom: 'UNKNOWN',
            learnedMapping: true
          }
        });

        console.log(`✅ Document reorganized to ${company.code}/${document.category}/`);
      }
    } else {
      console.log(`ℹ️ Document already assigned to company, updating mapping only`);
    }

    // Learn filename pattern for future auto-detection
    if (pattern || document.original_name) {
      const filenamePattern = pattern || document.original_name;
      
      // Extract meaningful patterns
      const patterns = extractFilenamePatterns(filenamePattern);
      
      // Add patterns to company keywords (only update keywords, not other fields)
      const currentKeywords = company.keywords || [];
      const newKeywords = [...new Set([...currentKeywords, ...patterns])];
      
      // Only update keywords to avoid null constraint issues
      const client = await pool.connect();
      try {
        await client.query(
          'UPDATE companies SET keywords = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newKeywords, company.id]
        );
      } finally {
        client.release();
      }

      console.log(`📝 Learned patterns: ${patterns.join(', ')} for ${company.code}`);
    }

    res.json({
      success: true,
      message: `Successfully learned that "${document.original_name}" belongs to ${company.code}`,
      document: {
        id: document.id,
        originalName: document.original_name,
        previousCompany: document.metadata?.companyCode || 'UNKNOWN',
        newCompany: company.code,
        category: document.category,
        reorganized: !!reorganizeResult,
        newPath: reorganizeResult ? reorganizeResult.path : document.file_path
      },
      learnedPatterns: pattern ? extractFilenamePatterns(pattern) : extractFilenamePatterns(document.original_name)
    });

  } catch (error) {
    console.error('Error in learnDocumentCompany:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
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

// Extract meaningful patterns from filename for learning
function extractFilenamePatterns(filename) {
  const patterns = [];
  
  // Extract common patterns
  const lowerFilename = filename.toLowerCase();
  
  // Pattern 1: Prefix patterns (QT.01, PDI-XX, etc.)
  const prefixMatch = filename.match(/^([A-Z]{2,4}[\.\-_]?\d*)/i);
  if (prefixMatch) {
    patterns.push(prefixMatch[1].toLowerCase());
  }
  
  // Pattern 2: Specific keywords
  const keywords = [
    'qt', 'quy trinh', 'quy dinh', 'lsx', 'nhl', 
    'soan', 'chuyen', 'luu', 'van ban'
  ];
  
  keywords.forEach(keyword => {
    if (lowerFilename.includes(keyword)) {
      patterns.push(keyword);
    }
  });
  
  // Pattern 3: Date patterns (200524 = DDMMYY)
  const dateMatch = filename.match(/(\d{6})/);
  if (dateMatch) {
    patterns.push('date_pattern');
  }
  
  return [...new Set(patterns)]; // Remove duplicates
}

module.exports = {
  learnFromText,
  getKnowledge,
  learnDocumentCompany
}; 