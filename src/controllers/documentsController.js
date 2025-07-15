const fs = require('fs');
const { db } = require('../../database');
const { extractTextFromPDF } = require('../utils/pdfExtractor');
const ocrService = require('../../ocr-service');

// Use demo service if no Google Cloud credentials available
let visionOCRService;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    visionOCRService = require('../../vision-ocr-service');
  } else {
    console.log('🧪 Using Vision OCR Demo Service (no Google Cloud credentials)');
    visionOCRService = require('../../vision-ocr-service-demo');
  }
} catch (error) {
  console.log('🧪 Falling back to Vision OCR Demo Service');
  visionOCRService = require('../../vision-ocr-service-demo');
}

const storageService = require('../../storage-service');

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

    const tempFilePath = req.file.path;
    const fileName = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    console.log(`🚀 Starting enhanced document upload: ${originalName}`);

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

    // Handle duplicate documents
    let documentToSave = null;
    let mergeInfo = null;

    if (processingResult.duplicateAnalysis.isDuplicate) {
      const similarDoc = processingResult.duplicateAnalysis.similarDocs[0];
      
      if (processingResult.duplicateAnalysis.recommendation === 'merge') {
        // Update existing document with merged content
        console.log(`🔗 Merging with document ID: ${similarDoc.id}`);
        
        documentToSave = await db.updateDocument(similarDoc.id, {
          content_text: contentText,
          file_size: fileSize,
          metadata: {
            ...processingResult.structureAnalysis,
            lastMerged: new Date().toISOString(),
            mergeReason: similarDoc.reason,
            originalFiles: [originalName],
            processingMethod: processingResult.processingMethod,
            classification: processingResult.classification,
            duplicateAnalysis: processingResult.duplicateAnalysis
          }
        });
        
        mergeInfo = {
          merged: true,
          mergedWithDocument: similarDoc.id,
          mergeReason: similarDoc.reason,
          similarity: similarDoc.similarity
        };
        
      } else if (processingResult.duplicateAnalysis.recommendation === 'replace') {
        // Replace existing document
        console.log(`🔄 Replacing document ID: ${similarDoc.id}`);
        
        documentToSave = await db.updateDocument(similarDoc.id, {
          filename: fileName,
          original_name: originalName,
          file_path: storageResult.path,
          file_size: fileSize,
          content_text: contentText,
          metadata: {
            ...processingResult.structureAnalysis,
            lastReplaced: new Date().toISOString(),
            replaceReason: similarDoc.reason,
            processingMethod: processingResult.processingMethod,
            classification: processingResult.classification,
            duplicateAnalysis: processingResult.duplicateAnalysis
          }
        });
        
        mergeInfo = {
          replaced: true,
          replacedDocument: similarDoc.id,
          replaceReason: similarDoc.reason,
          similarity: similarDoc.similarity
        };
      }
    }

    // Create new document if no merge/replace occurred
    if (!documentToSave) {
      documentToSave = await db.createDocument({
        filename: fileName,
        originalName: originalName,
        filePath: storageResult.path,
        fileSize: fileSize,
        content: contentText,
        companyId: companyId,
        category: category,
        metadata: {
          uploadedAt: new Date().toISOString(),
          contentLength: contentText.length,
          processingMethod: processingResult.processingMethod,
          classification: processingResult.classification,
          duplicateAnalysis: processingResult.duplicateAnalysis,
          structureAnalysis: processingResult.structureAnalysis,
          storageType: storageResult.storage,
          storageUrl: storageResult.url,
          companyCode: storageResult.company ? storageResult.company.code : null,
          detectedCategory: category,
          canAnswerQuestions: processingResult.structureAnalysis.canAnswerQuestions,
          keyTerms: processingResult.structureAnalysis.keyTerms,
          mainTopics: processingResult.structureAnalysis.mainTopics
        }
      });
    }

    // Mark as processed
    await db.updateDocumentProcessed(documentToSave.id, true);

    // Clean up temp file and OCR files
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    visionOCRService.cleanup();

    // Prepare response
    const response = {
      success: true,
      message: 'Document uploaded and processed successfully with AI enhancements',
      document: {
        id: documentToSave.id,
        filename: documentToSave.filename,
        originalName: documentToSave.original_name,
        filePath: documentToSave.file_path,
        fileSize: documentToSave.file_size,
        contentLength: contentText.length,
        uploadDate: documentToSave.upload_date,
        processed: documentToSave.processed,
        processingMethod: processingResult.processingMethod,
        storageType: storageResult.storage,
        storageUrl: storageResult.url,
        company: storageResult.company ? storageResult.company.code : null,
        category: category,
        metadata: documentToSave.metadata
      },
      aiAnalysis: {
        classification: processingResult.classification,
        duplicateAnalysis: processingResult.duplicateAnalysis,
        structureAnalysis: processingResult.structureAnalysis,
        canAnswerQuestions: processingResult.structureAnalysis.canAnswerQuestions,
        keyTopics: processingResult.structureAnalysis.mainTopics,
        documentType: processingResult.structureAnalysis.documentType
      }
    };

    // Add merge information if applicable
    if (mergeInfo) {
      response.mergeInfo = mergeInfo;
    }

    console.log(`✅ Document processing completed successfully`);
    console.log(`📊 Classification: ${processingResult.classification.category} (${processingResult.classification.confidence})`);
    console.log(`🔍 Document Type: ${processingResult.structureAnalysis.documentType}`);
    console.log(`📝 Can Answer: ${processingResult.structureAnalysis.canAnswerQuestions.length} question types`);

    res.json(response);

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

module.exports = {
  getDocuments,
  getDocumentById,
  uploadDocument,
  deleteDocument,
  reprocessDocument,
  searchDocuments
}; 