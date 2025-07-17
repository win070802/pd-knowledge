const fs = require('fs');
const path = require('path');
const { db } = require('../../database');
const { extractTextFromPDF } = require('../utils/pdfExtractor');
const ocrService = require('../../services/ocr-service');

// Use demo service if no Google Cloud credentials available
let visionOCRService;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    visionOCRService = require('../../services/vision-ocr-service');
  } else {
    console.log('🧪 Using Vision OCR Demo Service (no Google Cloud credentials)');
    visionOCRService = require('../../services/vision-ocr-service-demo');
  }
} catch (error) {
  console.log('🧪 Falling back to Vision OCR Demo Service');
  visionOCRService = require('../../services/vision-ocr-service-demo');
}

const storageService = require('../../services/storage-service');

// 确保元数据表存在
async function ensureMetadataTables() {
  try {
    // 检查元数据表是否存在
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'document_metadata'
      );
    `);
    
    // 如果表不存在，创建它们
    if (!tableExists.rows[0].exists) {
      console.log('📦 Creating metadata tables for cross-document validation...');
      
      // 读取SQL创建脚本
      const sqlPath = path.join(__dirname, '../../scripts/create-metadata-tables.sql');
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await db.query(sql);
        console.log('✅ Metadata tables created successfully');
      } else {
        // 如果找不到SQL文件，使用内联SQL
        await db.query(`
          -- Document metadata table
          CREATE TABLE IF NOT EXISTS document_metadata (
            id SERIAL PRIMARY KEY,
            document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
            entities JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(document_id)
          );

          -- Company metadata table
          CREATE TABLE IF NOT EXISTS company_metadata (
            id SERIAL PRIMARY KEY,
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(company_id)
          );

          -- Validation logs table
          CREATE TABLE IF NOT EXISTS validation_logs (
            id SERIAL PRIMARY KEY,
            document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
            validation_type VARCHAR(100) NOT NULL,
            original_text TEXT,
            corrected_text TEXT,
            entities_found JSONB DEFAULT '{}',
            corrections_applied JSONB DEFAULT '[]',
            conflicts_resolved JSONB DEFAULT '[]',
            confidence_score DECIMAL(3,2) DEFAULT 0.0,
            processing_time_ms INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
          );

          -- Entity references table for fast lookup
          CREATE TABLE IF NOT EXISTS entity_references (
            id SERIAL PRIMARY KEY,
            entity_name VARCHAR(255) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
            confidence DECIMAL(3,2) DEFAULT 1.0,
            created_at TIMESTAMP DEFAULT NOW()
          );

          -- Indexes for performance
          CREATE INDEX IF NOT EXISTS idx_document_metadata_document_id ON document_metadata(document_id);
          CREATE INDEX IF NOT EXISTS idx_company_metadata_company_id ON company_metadata(company_id);
          CREATE INDEX IF NOT EXISTS idx_validation_logs_document_id ON validation_logs(document_id);
          CREATE INDEX IF NOT EXISTS idx_entity_references_company_id ON entity_references(company_id);
          CREATE INDEX IF NOT EXISTS idx_entity_references_entity_name ON entity_references(entity_name);
        `);
        console.log('✅ Metadata tables created successfully (inline SQL)');
      }
    }
  } catch (error) {
    console.error('❌ Error ensuring metadata tables exist:', error);
    // 继续执行，不中断上传流程
  }
}

// Get all documents
const getDocuments = async (req, res) => {
  try {
    const documents = await db.getDocuments();
    res.json({ success: true, documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get document by ID
const getDocumentById = async (req, res) => {
  try {
    const document = await db.getDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    res.json({ success: true, document });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Enhanced upload PDF document with Vision API and AI features
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // 确保元数据表存在，以支持交叉文档验证
    await ensureMetadataTables();

    const tempFilePath = req.file.path;
    const fileName = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    console.log(`🚀 Starting enhanced document upload: ${originalName}`);

    // Debug log để kiểm tra giá trị file upload
    console.log('DEBUG req.file:', req.file);
    console.log('DEBUG fileName:', fileName, 'originalName:', originalName);

    // Upload to storage first to get company info
    const storageResult = await storageService.uploadFile(tempFilePath, fileName, originalName);
    const companyId = storageResult.company ? storageResult.company.id : null;

    // Use enhanced Vision API processing
    const processingResult = await visionOCRService.processDocumentWithEnhancements(
      tempFilePath, 
      fileName, 
      originalName, 
      companyId
    );

    // Lấy số trang PDF (nếu có)
    const pageCount = processingResult.pageCount || (processingResult.structureAnalysis && processingResult.structureAnalysis.pageCount) || null;

    // Check if document was rejected
    if (!processingResult.classification.accept) {
      // Clean up uploaded file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
      return res.status(400).json({
        success: false,
        error: `Document rejected: ${processingResult.classification.reason}`,
        classification: processingResult.classification
      });
    }

    const contentText = processingResult.text;
    const category = processingResult.classification.category;

    // Try to detect company from content if not detected from filename
    let finalCompany = storageResult.company;
    let finalStorageResult = storageResult;
    
    if (!finalCompany && contentText) {
      console.log(`🔍 No company detected from filename, scanning content...`);
      const detectedCompany = await storageService.detectCompanyFromContent(contentText);
      
      if (detectedCompany) {
        console.log(`🎯 Company detected from content: ${detectedCompany.code}`);
        
        // Reorganize file to correct company folder
        const reorganizeResult = await storageService.reorganizeFileByCompany(
          storageResult.path,
          fileName,
          detectedCompany,
          category
        );
        
        if (reorganizeResult) {
          finalCompany = detectedCompany;
          finalStorageResult = reorganizeResult;
          console.log(`✅ File reorganized to ${detectedCompany.code} folder`);
        }
      } else {
        console.log(`ℹ️ No company detected from content, keeping in UNKNOWN folder`);
      }
    }

    // Handle duplicate documents
    let documentToSave = null;
    let mergeInfo = null;
    
    const finalCompanyId = finalCompany ? finalCompany.id : null;

    // Handle duplicate documents
    if (processingResult.duplicateAnalysis.isDuplicate) {
      const recommendation = processingResult.duplicateAnalysis.recommendation;
      const similarDoc = processingResult.duplicateAnalysis.similarDocs[0];
      const existingDoc = await db.getDocumentById(similarDoc.id);
      let companyInfo = null;
      if (finalCompany && finalCompany.code) {
        companyInfo = await db.getCompanyByCode(finalCompany.code);
      }
      if (existingDoc) {
        // Merge dữ liệu cũ và mới
        const merged = await mergeDocumentData(existingDoc, {
          content_text: contentText,
          metadata: {
            ...processingResult.structureAnalysis,
            ...processingResult.classification,
            ...processingResult.duplicateAnalysis,
            ...processingResult,
            original_name: originalName,
            filename: fileName,
            fileSize: fileSize,
            uploader: req.user ? req.user.username : null
          }
        }, companyInfo);
        // Update existing document với dữ liệu đã merge
        const updatedDoc = await db.updateDocument(existingDoc.id, {
          content_text: merged.content_text,
          file_size: fileSize,
          metadata: merged.metadata,
          // Có thể cập nhật thêm các trường khác nếu cần
        });
        documentToSave = updatedDoc;
        mergeInfo = {
          action: 'merged',
          targetDocument: existingDoc.original_name,
          reason: similarDoc.reason
        };
        console.log(`🔗 Document deeply merged with existing: ${existingDoc.original_name}`);
      }
    }

    // Create new document if no merge/replace occurred
    if (!documentToSave) {
      documentToSave = await db.createDocument({
        filename: fileName,
        original_name: originalName, // Đảm bảo truyền đúng tên trường
        file_path: finalStorageResult.path,
        file_size: fileSize,
        page_count: pageCount,
        content_text: contentText,
        company_id: finalCompanyId,
        category: category,
        metadata: {
          uploadedAt: new Date().toISOString(),
          contentLength: contentText.length,
          page_count: pageCount,
          processingMethod: processingResult.processingMethod,
          classification: processingResult.classification,
          duplicateAnalysis: processingResult.duplicateAnalysis,
          structureAnalysis: processingResult.structureAnalysis,
          storageType: finalStorageResult.storage,
          storageUrl: finalStorageResult.url,
          companyCode: finalCompany ? finalCompany.code : 'UNKNOWN',
          detectedCategory: category,
          canAnswerQuestions: processingResult.structureAnalysis.canAnswerQuestions,
          keyTerms: processingResult.structureAnalysis.keyTerms,
          mainTopics: processingResult.structureAnalysis.mainTopics,
          contentDetectedCompany: finalCompany ? finalCompany.code : null,
          // Thêm structured metadata cho QA
          sections: processingResult.structureAnalysis.sections || [],
          logic: processingResult.structureAnalysis.logic || [],
          conditions: processingResult.structureAnalysis.conditions || []
        }
      });
    }

    // Mark as processed
    await db.updateDocumentProcessed(documentToSave.id, true);

    // ✨ NEW: Perform cross-document validation and OCR correction
    try {
      console.log(`🔄 Starting cross-document validation for document ${documentToSave.id}...`);
      
      // Kiểm tra kết nối database trước khi thực hiện validation
      if (!db) {
        throw new Error('Database connection is not available');
      }
      
      // Cấu hình visionOCRService để sử dụng kết nối database chính xác
      if (typeof visionOCRService.setDbConnection === 'function') {
        try {
          visionOCRService.setDbConnection(db);
        } catch (dbSetupError) {
          console.error('❌ Error setting up database connection:', dbSetupError);
          throw new Error(`Database setup error: ${dbSetupError.message}`);
        }
      } else {
        console.warn('⚠️ visionOCRService missing setDbConnection method');
      }
      
      // Thêm thông tin về trạng thái xử lý vào tài liệu
      await db.updateDocument(documentToSave.id, {
        processing_notes: JSON.stringify({
          validation_started: true,
          validation_timestamp: new Date().toISOString()
        })
      });
      
      const validationResult = await visionOCRService.performCrossDocumentValidation(
        documentToSave.id,
        contentText,
        originalName,
        finalCompanyId
      );
      
      // Kiểm tra lỗi từ kết quả validation
      if (validationResult.success === false || validationResult.errorType === 'validation_error') {
        console.error(`❌ Cross-document validation failed: ${validationResult.error}`);
        
        // Thêm thông tin lỗi vào metadata của tài liệu
        await db.updateDocument(documentToSave.id, {
          processing_notes: JSON.stringify({
            validation_error: validationResult.error,
            validation_error_type: validationResult.errorType,
            validation_timestamp: new Date().toISOString(),
            requires_manual_review: true
          })
        });
        
        // Nếu là lỗi database nghiêm trọng, trả về lỗi cho client
        if (validationResult.error && (
            validationResult.error.includes('database') || 
            validationResult.error.includes('connection') ||
            validationResult.error.includes('query')
        )) {
          throw new Error(`Database error during validation: ${validationResult.error}`);
        }
      } else if (validationResult.corrections && validationResult.corrections.length > 0) {
        console.log(`✅ Applied ${validationResult.corrections.length} OCR corrections to document ${documentToSave.id}`);
      }
      
      if (validationResult.conflicts && validationResult.conflicts.length > 0) {
        console.log(`📋 Resolved ${validationResult.conflicts.length} entity conflicts for document ${documentToSave.id}`);
      }
      
      console.log(`📊 Cross-document validation completed with confidence: ${validationResult.confidence}`);
      
    } catch (validationError) {
      console.error('⚠️ Cross-document validation error:', validationError);
      
      // Nếu là lỗi database nghiêm trọng, trả về lỗi cho client
      if (validationError.message && (
          validationError.message.includes('database') || 
          validationError.message.includes('connection') ||
          validationError.message.includes('query')
      )) {
        throw validationError; // Re-throw để dừng quá trình và trả về lỗi cho client
      }
      
      // Ghi chú lỗi vào tài liệu nhưng vẫn tiếp tục quá trình
      try {
        await db.updateDocument(documentToSave.id, {
          processing_notes: JSON.stringify({
            validation_error: validationError.message,
            validation_timestamp: new Date().toISOString(),
            requires_manual_review: true
          })
        });
      } catch (updateError) {
        console.error('❌ Could not update document with validation error:', updateError);
      }
    }

    // Clean up temp file and OCR files
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    visionOCRService.cleanup();

    // Success response with comprehensive information
    const response = {
      success: true,
      message: mergeInfo ? 
        `Document ${mergeInfo.action} successfully` : 
        'Document uploaded and processed successfully',
      id: documentToSave.id,
      filename: fileName,
      originalName: originalName,
      company: finalCompany ? finalCompany.code : 'UNKNOWN',
      companyDetection: {
        fromFilename: storageResult.company ? storageResult.company.code : null,
        fromContent: finalCompany && !storageResult.company ? finalCompany.code : null,
        finalCompany: finalCompany ? finalCompany.code : 'UNKNOWN'
      },
      category: category,
      cloudPath: finalStorageResult.storage === 'cloud' ? 
        finalStorageResult.path : null,
      fileSize: fileSize,
      contentLength: contentText.length,
      processingMethod: processingResult.processingMethod,
      classification: {
        category: processingResult.classification.category,
        confidence: processingResult.classification.confidence,
        businessRelevance: processingResult.classification.businessRelevance
      },
      duplicateAnalysis: processingResult.duplicateAnalysis,
      mergeInfo: mergeInfo,
      keyTerms: processingResult.structureAnalysis.keyTerms.slice(0, 10), // First 10 terms
      canAnswerQuestions: processingResult.structureAnalysis.canAnswerQuestions.slice(0, 5) // First 5 questions
    };

    console.log(`✅ Document upload completed: ${originalName} -> ${finalCompany ? finalCompany.code : 'UNKNOWN'}/${category}`);
    res.status(201).json(response);

  } catch (error) {
    console.error('Error uploading document:', error);
    
    // Clean up file if error occurred
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    visionOCRService.cleanup();
    
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.stack 
    });
  }
};

// Merge document data from old and new
async function mergeDocumentData(oldDoc, newDoc, companyInfo) {
  try {
    console.log('🔄 Merging document data...');
    
    // Kiểm tra nếu tài liệu thuộc về phòng ban khác nhau
    const visionOCRService = require('../../services/vision-ocr-service');
    
    if (oldDoc.original_name && newDoc.metadata?.original_name && 
        visionOCRService.filesReferToDifferentEntities(oldDoc.original_name, newDoc.metadata.original_name)) {
      console.log('🚨 Cannot merge documents from different departments!');
      
      // Thêm ghi chú vào metadata để track
      newDoc.metadata.merge_error = `Merge rejected: Documents appear to belong to different departments (${oldDoc.original_name} vs ${newDoc.metadata.original_name})`;
      
      // Trả về document mới mà không merge
      return {
        ...newDoc,
        content_text: newDoc.content_text || oldDoc.content_text,
        metadata: newDoc.metadata
      };
    }
    
    // If documents can be merged, proceed
    let mergedData = {
      content_text: oldDoc.content_text || '',
      metadata: { ...oldDoc.metadata }
    };
    
    // Merge content text if new content is not empty and different
    if (newDoc.content_text && newDoc.content_text.trim() !== oldDoc.content_text?.trim()) {
      // Use AI-assisted merge if available
      try {
        const mergedText = await visionOCRService.mergeSimilarDocuments(
          newDoc.content_text,
          oldDoc,
          'Document update'
        );
        mergedData.content_text = mergedText;
        console.log('✅ Content merged successfully with AI assistance');
      } catch (mergeError) {
        console.error('❌ AI merge failed, using new content:', mergeError);
        // Use the longer content if AI merge fails
        mergedData.content_text = newDoc.content_text.length > oldDoc.content_text.length ? 
          newDoc.content_text : oldDoc.content_text;
      }
    }
    
    // Merge metadata
    if (newDoc.metadata) {
      // Preserve existing structure/metadata
      mergedData.metadata = {
        ...mergedData.metadata,
        ...newDoc.metadata,
        version_history: [...(mergedData.metadata?.version_history || []), {
          timestamp: new Date().toISOString(),
          action: 'merge',
          original_name: newDoc.metadata.original_name,
          uploader: newDoc.metadata.uploader
        }]
      };
      
      // Đảm bảo các mảng key metadata được merge
      ['keyTerms', 'canAnswerQuestions', 'mainTopics'].forEach(key => {
        if (Array.isArray(newDoc.metadata[key]) && Array.isArray(mergedData.metadata[key])) {
          mergedData.metadata[key] = mergeArray(mergedData.metadata[key], newDoc.metadata[key]);
        } else if (Array.isArray(newDoc.metadata[key])) {
          mergedData.metadata[key] = newDoc.metadata[key];
        }
      });
      
      // Log merge
      const companyName = companyInfo ? companyInfo.name : 'Unknown';
      console.log(`✅ Merged metadata for document ${oldDoc.id} (Company: ${companyName})`);
    }
    
    return mergedData;
  } catch (error) {
    console.error('❌ Error merging document data:', error);
    throw error;
  }
}

// Helper function to merge arrays with deduplication
function mergeArray(a, b) {
  if (!Array.isArray(a)) a = [];
  if (!Array.isArray(b)) b = [];
  
  const uniqueMap = {};
  
  // Normalize string for comparison (lowercase, no diacritics)
  const normalize = str => typeof str === 'string' 
    ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
    : JSON.stringify(str);

  // Add all items from array a
  a.forEach(item => {
    const key = normalize(item);
    uniqueMap[key] = item;
  });
  
  // Add all items from array b
  b.forEach(item => {
    const key = normalize(item);
    uniqueMap[key] = item;
  });
  
  return Object.values(uniqueMap);
}

// Delete document
const deleteDocument = async (req, res) => {
  try {
    const documentId = req.params.id;
    const document = await db.getDocumentById(documentId);
    
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Delete file from filesystem
    if (fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path);
    }

    // Delete from database
    await db.deleteDocument(documentId);

    res.json({ success: true, message: 'Document deleted successfully' });

  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Reprocess document with AI text correction
const reprocessDocument = async (req, res) => {
  try {
    const documentId = req.params.id;
    const document = await db.getDocumentById(documentId);
    
    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    if (!document.content_text || document.content_text.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Document has no text content to reprocess' 
      });
    }

    console.log(`🔧 Reprocessing document ${documentId} with AI text correction...`);
    
    // Apply text correction to existing content
    const correctedText = await ocrService.correctOCRText(document.content_text);
    
    // Update document with corrected text
    const updatedDocument = await db.updateDocument(documentId, {
      content_text: correctedText
    });

    console.log(`✅ Document ${documentId} reprocessed successfully`);

    res.json({
      success: true,
      message: 'Document reprocessed with AI text correction',
      document: {
        id: updatedDocument.id,
        original_name: updatedDocument.original_name,
        originalTextLength: document.content_text.length,
        correctedTextLength: correctedText.length,
        improvement: correctedText.length - document.content_text.length
      }
    });

  } catch (error) {
    console.error('Error reprocessing document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Search documents
const searchDocuments = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }

    const documents = await db.searchDocuments(q.trim());
    res.json({ success: true, documents, searchTerm: q.trim() });

  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get document categories
const getCategories = async (req, res) => {
  try {
    // Lấy danh sách categories từ database
    const query = `
      SELECT DISTINCT category 
      FROM documents 
      WHERE category IS NOT NULL 
      ORDER BY category
    `;
    
    const result = await db.query(query);
    const categories = result.rows.map(row => row.category);
    
    res.json({ 
      success: true, 
      categories 
    });
  } catch (error) {
    console.error('Error fetching document categories:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Thêm hàm getDocumentsByCompany ở cuối file trước module.exports
const getDocumentsByCompany = async (req, res) => {
  try {
    const { companyCode } = req.params;
    
    if (!companyCode) {
      return res.status(400).json({ success: false, error: 'Company code is required' });
    }
    
    // Lấy thông tin công ty
    const company = await db.getCompanyByCode(companyCode);
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }
    
    // Lấy danh sách tài liệu theo công ty
    const documents = await db.getDocumentsByCompany(company.id);
    
    res.json({ 
      success: true, 
      documents,
      company
    });
  } catch (error) {
    console.error('Error fetching documents by company:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Cập nhật module.exports để thêm hàm mới
module.exports = {
  getDocuments,
  getDocumentById,
  uploadDocument,
  deleteDocument,
  reprocessDocument,
  searchDocuments,
  getCategories,
  getDocumentsByCompany
}; 