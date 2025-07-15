const { db } = require('../../database');
const { pool } = require('../config/database');
const storageService = require('../../services/storage-service');
const GeminiAiService = require('../services/ai/geminiAiService');

// Learn from free text input - Fully AI-Autonomous
const learnFromText = async (req, res) => {
  try {
    const { 
      text, 
      question, 
      answer,
      keywords 
    } = req.body;

    if (!text && !(question && answer)) {
      return res.status(400).json({
        error: 'Either "text" or both "question" and "answer" are required'
      });
    }

    let knowledgeEntries = [];

    if (text) {
      // Fully autonomous AI processing - no manual input needed
      const aiService = new GeminiAiService();
      console.log(`🤖 AI analyzing text autonomously: "${text.substring(0, 50)}..."`);
      
      const analysisResult = await analyzeTextAutonomously(text, aiService);
      console.log(`🧠 AI autonomous analysis completed - generated ${analysisResult.entries.length} knowledge entries`);
      
             // Process each entry with detected company and category
       for (const entry of analysisResult.entries) {
         const processedEntry = await processAutonomousKnowledgeEntry(entry, analysisResult.detectedCompany, analysisResult.detectedCategory, aiService);
         knowledgeEntries.push(processedEntry);
       }
      
    } else {
      // Direct Q&A input (fallback for manual entry)
      const finalKeywords = keywords || extractKeywords(question + ' ' + answer);
      
      const knowledge = await db.createKnowledge({
        companyId: null, // Will be detected later if needed
        question: question,
        answer: answer,
        keywords: finalKeywords,
        category: 'General',
        isActive: true
      });
      
      knowledgeEntries.push(knowledge);
    }

    console.log(`📚 AI autonomously processed and saved ${knowledgeEntries.length} knowledge entries`);

    res.status(201).json({
      success: true,
      message: `AI successfully analyzed and added ${knowledgeEntries.length} knowledge entries autonomously`,
      analysis: {
        detectedCompany: knowledgeEntries[0]?.company_detected || 'Not detected',
        detectedCategory: knowledgeEntries[0]?.category || 'General',
        entriesGenerated: knowledgeEntries.length,
        hasHistoricalUpdates: knowledgeEntries.some(k => k.isHistoricalUpdate)
      },
      knowledge: knowledgeEntries.map(k => ({
        id: k.id,
        company: k.company_detected || null,
        question: k.question,
        answer: k.answer.length > 100 ? k.answer.substring(0, 100) + '...' : k.answer,
        category: k.category,
        keywordsCount: k.keywords?.length || 0,
        isHistoricalUpdate: k.isHistoricalUpdate || false
      }))
    });

  } catch (error) {
    console.error('Error in fully autonomous learn API:', error);
    res.status(500).json({
      error: 'Failed to autonomously process and add knowledge',
      details: error.message
    });
  }
};

// Fully autonomous AI text analysis - detects company, category, and generates Q&A
async function analyzeTextAutonomously(text, aiService) {
  try {
    const autonomousPrompt = `
Phân tích hoàn toàn tự động đoạn text sau. Bạn cần:
1. TỰ ĐỘNG PHÁT HIỆN CÔNG TY từ text (PDH, PDI, PDE, PDHH, RH...)
2. TỰ ĐỘNG PHÂN LOẠI CATEGORY (Leadership, HR, Finance, Operations, IT, Legal, General...)
3. TẠO CÁC CẶP Q&A THÔNG MINH

TEXT INPUT: "${text}"

YÊU CẦU PHÂN TÍCH:
- Detect company: Tìm mã công ty trong text (PDH, PDI, PDE, PDHH, RH...) hoặc null nếu không có
- Classify category: Phân loại nội dung (Leadership=lãnh đạo/CXO, HR=nhân sự, Finance=tài chính, Operations=vận hành, IT=công nghệ, Legal=pháp lý, General=khác)
- Generate Q&A: Tạo nhiều cặp câu hỏi-trả lời thông minh từ thông tin

VÍ DỤ PHÂN TÍCH:
Text: "Giám đốc CIO của PDH là ông Lê Nguyễn Hoàng Minh"
→ Company: "PDH" (detected từ text)
→ Category: "Leadership" (vì là thông tin về lãnh đạo CXO)
→ Generate multiple Q&A pairs

FORMAT TRẢ LỜI:
{
  "detectedCompany": "PDH",
  "detectedCategory": "Leadership", 
  "confidence": {
    "company": 0.95,
    "category": 0.90
  },
  "entries": [
    {
      "question": "Ai là CIO của PDH?",
      "answer": "CIO của PDH là ông Lê Nguyễn Hoàng Minh",
      "type": "person_role",
      "keywords": ["CIO", "PDH", "Lê Nguyễn Hoàng Minh"],
      "relatedQuestions": ["Lê Nguyễn Hoàng Minh là ai?"]
    }
  ]
}

CHỈ trả về JSON với format trên, không thêm text khác:`;

    const result = await aiService.model.generateContent(autonomousPrompt);
    const response = await result.response;
    let analysisText = response.text().trim();
    
    // Clean up response
    analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    console.log(`🔍 Autonomous AI Analysis:`, analysisText);
    
    try {
      const parsedResult = JSON.parse(analysisText);
      
      // Validate and set defaults
      return {
        detectedCompany: parsedResult.detectedCompany || null,
        detectedCategory: parsedResult.detectedCategory || 'General',
        confidence: parsedResult.confidence || { company: 0.5, category: 0.5 },
        entries: Array.isArray(parsedResult.entries) ? parsedResult.entries : [parsedResult.entries || createFallbackEntry(text)]
      };
    } catch (parseError) {
      console.warn('⚠️ Could not parse autonomous AI response, using fallback');
      return createFallbackAutonomousResult(text);
    }
    
  } catch (error) {
    console.error('❌ Error in autonomous AI analysis:', error);
    return createFallbackAutonomousResult(text);
  }
}

// Fallback autonomous result if AI analysis fails
function createFallbackAutonomousResult(text) {
  return {
    detectedCompany: null,
    detectedCategory: 'General',
    confidence: { company: 0.1, category: 0.5 },
    entries: [createFallbackEntry(text)]
  };
}

// Create fallback entry for failed analysis
function createFallbackEntry(text) {
  return {
    question: `Kiến thức từ text`,
    answer: text,
    type: 'general',
    keywords: extractKeywords(text),
    relatedQuestions: []
  };
}

// Process autonomous knowledge entry with detected company and category
async function processAutonomousKnowledgeEntry(entry, detectedCompanyCode, detectedCategory, aiService) {
  try {
    // Resolve detected company from database
    let company = null;
    if (detectedCompanyCode) {
      company = await db.getCompanyByCode(detectedCompanyCode.toUpperCase());
      if (company) {
        console.log(`✅ Detected company "${detectedCompanyCode}" resolved to: ${company.full_name}`);
      } else {
        console.log(`⚠️ Detected company "${detectedCompanyCode}" not found in database`);
      }
    }

    // Check if this is an update to existing knowledge
    const existingKnowledge = await findSimilarKnowledge(entry.question, company?.id);
    
    let finalEntry = {
      companyId: company ? company.id : null,
      question: entry.question,
      answer: entry.answer,
      keywords: Array.isArray(entry.keywords) ? entry.keywords : extractKeywords(entry.question + ' ' + entry.answer),
      category: detectedCategory || 'General',
      isActive: true
    };

    if (existingKnowledge && existingKnowledge.length > 0) {
      // This is potentially an update - handle historical tracking
      console.log(`🔄 Found ${existingKnowledge.length} similar knowledge entries, processing autonomous update...`);
      
      const historicalUpdate = await handleHistoricalUpdate(entry, existingKnowledge, aiService);
      finalEntry.answer = historicalUpdate.answer;
      finalEntry.isHistoricalUpdate = true;
      
      // Mark old entries as inactive
      for (const oldEntry of existingKnowledge) {
        await db.updateKnowledge(oldEntry.id, { isActive: false });
      }
    }

    // Create new knowledge entry
    const savedKnowledge = await db.createKnowledge(finalEntry);
    savedKnowledge.isHistoricalUpdate = finalEntry.isHistoricalUpdate;
    savedKnowledge.company_detected = detectedCompanyCode; // Store detected company for response
    
    // Create related questions as separate entries
    if (entry.relatedQuestions && entry.relatedQuestions.length > 0) {
      for (const relatedQ of entry.relatedQuestions) {
        await db.createKnowledge({
          companyId: company ? company.id : null,
          question: relatedQ,
          answer: entry.answer,
          keywords: finalEntry.keywords,
          category: detectedCategory || 'General',
          isActive: true
        });
      }
    }
    
    return savedKnowledge;
    
  } catch (error) {
    console.error('❌ Error processing autonomous knowledge entry:', error);
    throw error;
  }
}

// Find similar existing knowledge
async function findSimilarKnowledge(question, companyId) {
  try {
    const client = await pool.connect();
    
    try {
      let query = `
        SELECT * FROM knowledge_base 
        WHERE is_active = true
        AND question ILIKE $1
      `;
      const params = [`%${question.split(' ').slice(-3).join(' ')}%`]; // Search for key words
      
      if (companyId) {
        query += ` AND company_id = $2`;
        params.push(companyId);
      }
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error finding similar knowledge:', error);
    return [];
  }
}

// Handle historical updates with AI assistance
async function handleHistoricalUpdate(newEntry, existingEntries, aiService) {
  try {
    const updatePrompt = `
Có thông tin mới cần cập nhật. Hãy tạo câu trả lời có lịch sử:

THÔNG TIN CŨ:
${existingEntries.map(e => `- ${e.answer}`).join('\n')}

THÔNG TIN MỚI: ${newEntry.answer}

YÊU CẦU:
1. Tạo câu trả lời bao gồm cả thông tin hiện tại và lịch sử
2. Sử dụng format: "Hiện tại là X. Trước đó là Y."
3. Thông tin mới được ưu tiên (là thông tin hiện tại)
4. Thông tin cũ thành lịch sử

Ví dụ: "CIO của PDH hiện tại là ông Lê Nguyễn Hoàng Minh. Trước đó là ông Nguyễn Văn A."

CHỈ trả về câu trả lời, không thêm text khác:`;

    const result = await aiService.model.generateContent(updatePrompt);
    const response = await result.response;
    const updatedAnswer = response.text().trim();
    
    return {
      answer: updatedAnswer,
      hasHistory: true
    };
    
  } catch (error) {
    console.error('❌ Error creating historical update:', error);
    return {
      answer: newEntry.answer,
      hasHistory: false
    };
  }
}

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