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
      keywords,
      isCorrection = false  // Cờ đánh dấu đây là thông tin sửa lỗi/cập nhật
    } = req.body;

    if (!text && !(question && answer)) {
      return res.status(400).json({
        error: 'Either "text" or both "question" and "answer" are required'
      });
    }

    let knowledgeEntries = [];
    let updatedEntries = [];
    let historicalEntries = [];

    if (text) {
      // Fully autonomous AI processing - no manual input needed
      const aiService = new GeminiAiService();
      console.log(`🤖 AI analyzing text autonomously: "${text.substring(0, 50)}..."`);
      
      const analysisResult = await analyzeTextAutonomously(text, aiService, isCorrection);
      console.log(`🧠 AI autonomous analysis completed - generated ${analysisResult.entries.length} knowledge entries`);
      
      // Process each entry with detected company and category
      for (const entry of analysisResult.entries) {
        const processResult = await processAutonomousKnowledgeEntry(entry, analysisResult.detectedCompany, analysisResult.detectedCategory, aiService, isCorrection);
        
        if (processResult.isUpdated) {
          updatedEntries.push(processResult.entry);
          if (processResult.historicalEntry) {
            historicalEntries.push(processResult.historicalEntry);
          }
        } else {
          knowledgeEntries.push(processResult.entry);
        }
      }
      
    } else {
      // Direct Q&A input (fallback for manual entry)
      const finalKeywords = keywords || extractKeywords(question + ' ' + answer);
      
      // Tìm kiếm kiến thức tương tự để cập nhật nếu là correction
      if (isCorrection) {
        const similarEntries = await findSimilarKnowledge(question);
        
        if (similarEntries && similarEntries.length > 0) {
          const aiService = new GeminiAiService();
          const historicalData = await handleHistoricalUpdate(
            { question, answer },
            similarEntries,
            aiService
          );
          
          // Cập nhật entry cũ
          const updatedEntry = await db.updateKnowledge(similarEntries[0].id, {
            question: question,
            answer: historicalData.answer,
            keywords: finalKeywords,
            category: similarEntries[0].category,
            isActive: true
          });
          
          updatedEntries.push(updatedEntry);
        } else {
          // Nếu không tìm thấy entry tương tự, tạo mới
          const newEntry = await db.createKnowledge({
            companyId: null,
            question: question,
            answer: answer,
            keywords: finalKeywords,
            category: 'General',
            isActive: true
          });
          
          knowledgeEntries.push(newEntry);
        }
      } else {
        // Không phải correction, tạo mới bình thường
        const knowledge = await db.createKnowledge({
          companyId: null,
          question: question,
          answer: answer,
          keywords: finalKeywords,
          category: 'General',
          isActive: true
        });

        knowledgeEntries.push(knowledge);
      }
    }

    const totalEntries = knowledgeEntries.length + updatedEntries.length;
    console.log(`📚 AI autonomously processed and saved ${totalEntries} knowledge entries (${updatedEntries.length} updated, ${knowledgeEntries.length} new)`);

    res.status(201).json({
      success: true,
      message: isCorrection 
        ? `AI successfully corrected ${updatedEntries.length} and added ${knowledgeEntries.length} knowledge entries` 
        : `AI successfully analyzed and added ${totalEntries} knowledge entries autonomously`,
      analysis: {
        detectedCompany: (knowledgeEntries[0] || updatedEntries[0])?.company_detected || 'Not detected',
        detectedCategory: (knowledgeEntries[0] || updatedEntries[0])?.category || 'General',
        entriesGenerated: totalEntries,
        entriesUpdated: updatedEntries.length,
        hasHistoricalUpdates: updatedEntries.length > 0
      },
      knowledge: [...knowledgeEntries, ...updatedEntries].map(k => ({
        id: k.id,
        company: k.company_detected || null,
        question: k.question,
        answer: k.answer.length > 100 ? k.answer.substring(0, 100) + '...' : k.answer,
        category: k.category,
        keywordsCount: k.keywords?.length || 0,
        isHistoricalUpdate: k.isHistoricalUpdate || false,
        isUpdated: updatedEntries.some(u => u.id === k.id)
      })),
      historicalEntries: historicalEntries.length > 0 ? historicalEntries : undefined
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
async function analyzeTextAutonomously(text, aiService, isCorrection = false) {
  try {
    const autonomousPrompt = `
Phân tích SIÊU THÔNG MINH đoạn text phức tạp sau. Bạn cần:
1. TỰ ĐỘNG PHÁT HIỆN CÔNG TY từ text (PDH, PDI, PDE, PDHOS, RHS...)
2. TỰ ĐỘNG PHÂN LOẠI CATEGORY (Leadership, HR, Finance, Operations, IT, Legal, General...)
3. TẠO NHIỀU CẶP Q&A THÔNG MINH - bao gồm CẢ SỐ LƯỢNG, DANH SÁCH, VAI TRÒ, THÔNG TIN CHI TIẾT
${isCorrection ? '4. PHÁT HIỆN NẾU ĐÂY LÀ THÔNG TIN CẬP NHẬT/SỬA LỖI - đánh dấu update_type: "correction" hoặc "historical_update"' : ''}

TEXT INPUT: "${text}"

YÊU CẦU PHÂN TÍCH SIÊU THÔNG MINH:
- Detect company: Tìm mã công ty trong text (PDH, PDI, PDE, PDHOS, RHS...) hoặc null nếu không có
- Classify category: IT=công nghệ, Leadership=lãnh đạo/CXO, HR=nhân sự, Finance=tài chính, Operations=vận hành, Legal=pháp lý, General=khác
- Generate COMPREHENSIVE Q&A: Từ 1 text → tạo ra TẤT CẢ câu hỏi có thể:
  * Số lượng: "Team X có mấy người?" 
  * Danh sách: "Team X có ai?"
  * Vai trò cụ thể: "Ai là CIO/CEO/trưởng phòng?"
  * Thông tin chi tiết: "Nguyễn Văn A làm gì?"
  * So sánh: "Ai quản lý hạ tầng?"
${isCorrection ? `
- Detect correction type:
  * "correction": Sửa lỗi hoàn toàn mới (thông tin trước đây sai)
  * "historical_update": Cập nhật theo thời gian (thông tin cũ đúng vào thời điểm đó, nhưng giờ đã thay đổi)
  * "new_info": Thông tin hoàn toàn mới, không liên quan đến dữ liệu cũ` : ''}

VÍ DỤ PHÂN TÍCH SIÊU THÔNG MINH:
Text: "ban công nghệ thông tin pdh gồm có 4 người là lê nguyễn hoàng minh (cio), nguyễn đức doanh (trưởng bộ phận hạ tầng), trần minh khôi (nhân viên it), nguyễn quang đợi (chuyên viên phần mềm)"
→ Company: "PDH"  
→ Category: "IT"
→ Generate 8-10 Q&A pairs covering:
  • Số lượng: "Team IT PDH có mấy người?" → "4 người"
  • Danh sách: "Team IT PDH có ai?" → "Lê Nguyễn Hoàng Minh (CIO), Nguyễn Đức Doanh (trưởng bộ phận hạ tầng)..."
  • Vai trò: "Ai là CIO PDH?" → "Lê Nguyễn Hoàng Minh"
  • Chi tiết: "Nguyễn Đức Doanh làm gì?" → "Trưởng bộ phận quản lý hạ tầng và bảo mật"

FORMAT TRẢ LỜI:
{
  "detectedCompany": "PDH",
  "detectedCategory": "IT", 
  "confidence": {
    "company": 0.98,
    "category": 0.95
  },
  "entries": [
    {
      "question": "Team IT của PDH có bao nhiêu người?",
      "answer": "Team IT của PDH có 4 người.",
      "type": "count_query",
      "keywords": ["team", "IT", "PDH", "4 người", "số lượng"],
      "relatedQuestions": ["Ban công nghệ thông tin PDH có mấy thành viên?"],
      ${isCorrection ? '"update_type": "new_info",' : ''}
      "metadata": {
        "entities": ["Team IT", "PDH"],
        "roles": [],
        "numerical_values": [{"type": "count", "value": 4, "unit": "người"}]
      }
    },
    {
      "question": "Team IT của PDH có những ai?",
      "answer": "Team IT của PDH gồm có Lê Nguyễn Hoàng Minh (CIO), Nguyễn Đức Doanh (trưởng bộ phận hạ tầng và bảo mật), Trần Minh Khôi (nhân viên công nghệ thông tin), Nguyễn Quang Đợi (chuyên viên cao cấp phát triển phần mềm).",
      "type": "list_query",
      "keywords": ["team", "IT", "PDH", "danh sách", "thành viên"],
      "relatedQuestions": ["Danh sách nhân viên IT PDH?"],
      ${isCorrection ? '"update_type": "new_info",' : ''}
      "metadata": {
        "entities": ["Team IT", "PDH"],
        "people": ["Lê Nguyễn Hoàng Minh", "Nguyễn Đức Doanh", "Trần Minh Khôi", "Nguyễn Quang Đợi"],
        "roles": [
          {"person": "Lê Nguyễn Hoàng Minh", "role": "CIO"},
          {"person": "Nguyễn Đức Doanh", "role": "trưởng bộ phận hạ tầng và bảo mật"},
          {"person": "Trần Minh Khôi", "role": "nhân viên công nghệ thông tin"},
          {"person": "Nguyễn Quang Đợi", "role": "chuyên viên cao cấp phát triển phần mềm"}
        ]
      }
    },
    {
      "question": "Ai là CIO của PDH?",
      "answer": "CIO của PDH là Lê Nguyễn Hoàng Minh.",
      "type": "role_query",
      "keywords": ["CIO", "PDH", "Lê Nguyễn Hoàng Minh"],
      "relatedQuestions": ["Lê Nguyễn Hoàng Minh giữ chức vụ gì?"],
      ${isCorrection ? '"update_type": "new_info",' : ''}
      "metadata": {
        "entities": ["PDH"],
        "people": ["Lê Nguyễn Hoàng Minh"],
        "roles": [{"person": "Lê Nguyễn Hoàng Minh", "role": "CIO", "organization": "PDH"}]
      }
    }
  ]
}

QUAN TRỌNG: Tạo ra ít nhất 6-8 Q&A pairs cho mỗi text phức tạp, bao phủ TẤT CẢ góc độ câu hỏi có thể.
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
    relatedQuestions: [],
    metadata: {
      entities: [],
      people: [],
      roles: []
    }
  };
}

// Process autonomous knowledge entry with detected company and category
async function processAutonomousKnowledgeEntry(entry, detectedCompanyCode, detectedCategory, aiService, isCorrection = false) {
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

    // Prepare basic entry data
    let finalEntry = {
      companyId: company ? company.id : null,
      question: entry.question,
      answer: entry.answer,
      keywords: Array.isArray(entry.keywords) ? entry.keywords : extractKeywords(entry.question + ' ' + entry.answer),
      category: detectedCategory || 'General',
      isActive: true
    };

    // Extract metadata if available
    const metadata = entry.metadata || {
      entities: [],
      people: [],
      roles: []
    };

    // Check if this is an update to existing knowledge
    const similarEntries = await findSimilarKnowledge(entry.question, company?.id);
    let result = { isUpdated: false, entry: null, historicalEntry: null };

    // Determine if this entry is a correction/update based on entry.update_type or isCorrection flag
    const needsHistoricalUpdate = isCorrection || 
                                 (entry.update_type === 'correction' || entry.update_type === 'historical_update');

    if (similarEntries && similarEntries.length > 0 && needsHistoricalUpdate) {
      console.log(`🔄 Found ${similarEntries.length} similar entries that need to be updated`);
      
      // Get historical data with AI help
      const historicalData = await handleHistoricalUpdate(
        { question: entry.question, answer: entry.answer },
        similarEntries,
        aiService
      );
      
      // Update the existing entry with historical context
      const updatedEntry = await db.updateKnowledge(similarEntries[0].id, {
        question: entry.question,
        answer: historicalData.answer,
        keywords: finalEntry.keywords,
        category: finalEntry.category,
        isActive: true
      });
      
      updatedEntry.company_detected = detectedCompanyCode;
      updatedEntry.isHistoricalUpdate = true;
      updatedEntry.metadata = {
        ...similarEntries[0].metadata,
        ...metadata,
        updatedAt: new Date().toISOString(),
        previousValue: similarEntries[0].answer
      };
      
      result = { 
        isUpdated: true, 
        entry: updatedEntry, 
        historicalEntry: {
          id: similarEntries[0].id,
          previousAnswer: similarEntries[0].answer,
          newAnswer: updatedEntry.answer
        } 
      };
      
    } else {
      // Create new knowledge entry
      finalEntry.metadata = metadata;
      
      const savedKnowledge = await db.createKnowledge(finalEntry);
      savedKnowledge.company_detected = detectedCompanyCode;
      
      result = { isUpdated: false, entry: savedKnowledge };
      
      // Create related questions as separate entries
      if (entry.relatedQuestions && entry.relatedQuestions.length > 0) {
        console.log(`📝 Creating ${entry.relatedQuestions.length} related question entries`);
        for (const relatedQ of entry.relatedQuestions) {
          await db.createKnowledge({
            companyId: company ? company.id : null,
            question: relatedQ,
            answer: entry.answer,
            keywords: finalEntry.keywords,
            category: detectedCategory || 'General',
            metadata: metadata,
            isActive: true
          });
        }
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Error processing autonomous knowledge entry:', error);
    throw error;
  }
}

// Find similar existing knowledge
async function findSimilarKnowledge(question, companyId = null) {
  try {
    const client = await pool.connect();
    
    try {
      // Tìm kiếm dựa trên nội dung câu hỏi
      const questionWords = question.split(' ')
        .filter(word => word.length > 3)
        .slice(0, 5);
      
      // Tạo pattern tìm kiếm dựa trên các từ khóa quan trọng
      let patterns = questionWords.map(word => `%${word}%`);
      
      // Câu truy vấn cơ bản
      let query = `
        SELECT * FROM knowledge_base 
        WHERE is_active = true
        AND (`;
      
      // Thêm điều kiện tìm kiếm cho mỗi từ khóa
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      for (const pattern of patterns) {
        conditions.push(`question ILIKE $${paramIndex}`);
        params.push(pattern);
        paramIndex++;
      }
      
      query += conditions.join(' OR ');
      query += ')';
      
      // Thêm điều kiện công ty nếu có
      if (companyId) {
        query += ` AND (company_id = $${paramIndex} OR company_id IS NULL)`;
        params.push(companyId);
        paramIndex++;
      }
      
      query += ` ORDER BY created_at DESC LIMIT 5`;
      
      console.log('🔍 Executing similar knowledge query:', query);
      console.log('With params:', params);
      
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
1. Phân tích xem thông tin mới có MÂU THUẪN với thông tin cũ hay chỉ là BỔ SUNG
2. Tạo câu trả lời tích hợp cả thông tin cũ và mới một cách hợp lý:
   * Nếu là MÂU THUẪN (ví dụ: người giữ chức vụ thay đổi): 
     "Hiện tại [thông tin mới]. Trước đó là [thông tin cũ]."
   * Nếu là BỔ SUNG (thông tin mới chi tiết hơn):
     Kết hợp cả thông tin cũ và mới thành câu trả lời đầy đủ nhất

3. Đảm bảo thông tin mới được ưu tiên (là thông tin hiện tại)
4. Thông tin cũ được giữ lại làm tham khảo lịch sử khi cần

Ví dụ 1 (MÂU THUẪN):
- CŨ: "CIO của PDH là ông Nguyễn Văn A"
- MỚI: "Ông Lê Nguyễn Hoàng Minh là CIO của PDH"
→ "CIO của PDH hiện tại là ông Lê Nguyễn Hoàng Minh. Trước đó là ông Nguyễn Văn A."

Ví dụ 2 (BỔ SUNG):
- CŨ: "Team IT có 4 người"
- MỚI: "Team IT gồm Minh, Doanh, Khôi và Đợi"
→ "Team IT có 4 người gồm Minh, Doanh, Khôi và Đợi."

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
        metadata: k.metadata || {},
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