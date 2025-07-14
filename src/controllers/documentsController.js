const fs = require('fs');
const { db } = require('../../database');
const { extractTextFromPDF } = require('../utils/pdfExtractor');
const ocrService = require('../../ocr-service');
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

// Upload PDF document
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const tempFilePath = req.file.path;
    const fileName = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    // Extract text from PDF (with OCR support for scanned PDFs)
    const contentText = await extractTextFromPDF(tempFilePath);

    // Upload to storage (cloud or local) with company detection
    const storageResult = await storageService.uploadFile(tempFilePath, fileName, originalName);

    // Detect category from filename  
    const category = storageService.detectCategoryFromFileName(originalName);

    // Determine processing method
    const isScanned = ocrService.isScannedPDF(contentText);
    const processingMethod = isScanned ? 'OCR' : 'Standard';

    // Save document to database with company and category
    const document = await db.createDocument({
      filename: fileName,
      originalName: originalName,
      filePath: storageResult.path,
      fileSize: fileSize,
      content: contentText,
      companyId: storageResult.company ? storageResult.company.id : null,
      category: category,
      metadata: {
        uploadedAt: new Date().toISOString(),
        contentLength: contentText.length,
        processingMethod: processingMethod,
        isScanned: isScanned,
        storageType: storageResult.storage,
        storageUrl: storageResult.url,
        companyCode: storageResult.company ? storageResult.company.code : null,
        detectedCategory: category
      }
    });

    // Mark as processed
    await db.updateDocumentProcessed(document.id, true);

    // Clean up temp file and OCR files
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    ocrService.cleanup();

    res.json({
      success: true,
      message: 'Document uploaded and processed successfully',
      document: {
        id: document.id,
        filename: document.filename,
        originalName: document.original_name,
        filePath: document.file_path,
        fileSize: document.file_size,
        contentLength: contentText.length,
        uploadDate: document.upload_date,
        processed: document.processed,
        processingMethod: processingMethod,
        isScanned: isScanned,
        storageType: storageResult.storage,
        storageUrl: storageResult.url,
        metadata: document.metadata
      }
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    // Clean up file if error occurred
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
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