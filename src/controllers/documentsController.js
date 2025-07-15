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

const storageService = require('../../services/storage-service');

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
      
      if (recommendation === 'merge') {
        // Merge with existing document
        const similarDoc = processingResult.duplicateAnalysis.similarDocs[0];
        const existingDoc = await db.getDocumentById(similarDoc.id);
        
        if (existingDoc) {
          // Update existing document with merged content
          const updatedDoc = await db.updateDocument(existingDoc.id, {
            content_text: contentText, // Use the enhanced merged content
            file_size: fileSize,
            metadata: {
              ...existingDoc.metadata,
              mergedWith: originalName,
              lastMergeDate: new Date().toISOString(),
              mergeReason: similarDoc.reason
            }
          });
          
          documentToSave = updatedDoc;
          mergeInfo = {
            action: 'merged',
            targetDocument: existingDoc.original_name,
            reason: similarDoc.reason
          };
          
          console.log(`🔗 Document merged with existing: ${existingDoc.original_name}`);
        }
      } else if (recommendation === 'replace') {
        // Replace existing document
        const similarDoc = processingResult.duplicateAnalysis.similarDocs[0];
        const existingDoc = await db.getDocumentById(similarDoc.id);
        
        if (existingDoc) {
          const updatedDoc = await db.updateDocument(existingDoc.id, {
            filename: fileName,
            original_name: originalName,
            file_path: finalStorageResult.path,
            file_size: fileSize,
            content_text: contentText,
            company_id: finalCompanyId,
            category: category,
            metadata: {
              replacedAt: new Date().toISOString(),
              previousVersion: existingDoc.original_name,
              replaceReason: similarDoc.reason
            }
          });
          
          documentToSave = updatedDoc;
          mergeInfo = {
            action: 'replaced',
            previousDocument: existingDoc.original_name,
            reason: similarDoc.reason
          };
          
          console.log(`🔄 Document replaced existing: ${existingDoc.original_name}`);
        }
      }
    }

    // Create new document if no merge/replace occurred
    if (!documentToSave) {
      documentToSave = await db.createDocument({
        filename: fileName,
        originalName: originalName,
        filePath: finalStorageResult.path,
        fileSize: fileSize,
        content: contentText,
        companyId: finalCompanyId,
        category: category,
        metadata: {
          uploadedAt: new Date().toISOString(),
          contentLength: contentText.length,
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
          contentDetectedCompany: finalCompany ? finalCompany.code : null
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