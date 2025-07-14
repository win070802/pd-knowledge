const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { initializeDatabase, db } = require('./database');
const geminiService = require('./gemini');
const ocrService = require('./ocr-service');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

// Enhanced utility function to extract text from PDF (including scanned PDFs)
async function extractTextFromPDF(filePath) {
  try {
    console.log('📄 Extracting text from PDF...');
    
    // First, try standard PDF text extraction
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    let extractedText = data.text;
    
    console.log(`📊 Standard extraction: ${extractedText.length} characters`);
    
    // Check if PDF is likely scanned (has very little meaningful text)
    if (ocrService.isScannedPDF(extractedText)) {
      console.log('🔍 Detected scanned PDF, using OCR...');
      
      try {
        // Use OCR for scanned PDFs
        const ocrText = await ocrService.processScannedPDF(filePath);
        
        if (ocrText && ocrText.trim().length > extractedText.trim().length) {
          extractedText = ocrText;
          console.log(`✅ OCR successful: ${extractedText.length} characters`);
        } else {
          console.log('⚠️ OCR did not improve text extraction');
        }
      } catch (ocrError) {
        console.error('❌ OCR failed:', ocrError.message);
        // Continue with standard extraction even if OCR fails
      }
    }
    
    return extractedText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get all documents
app.get('/api/documents', async (req, res) => {
  try {
    const documents = await db.getDocuments();
    res.json({ success: true, documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get document by ID
app.get('/api/documents/:id', async (req, res) => {
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
});

// Upload PDF document
app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    // Extract text from PDF (with OCR support for scanned PDFs)
    const contentText = await extractTextFromPDF(filePath);

    // Determine processing method
    const isScanned = ocrService.isScannedPDF(contentText);
    const processingMethod = isScanned ? 'OCR' : 'Standard';

    // Save document to database
    const document = await db.createDocument({
      filename: fileName,
      originalName: originalName,
      filePath: filePath,
      fileSize: fileSize,
      content: contentText,
      metadata: {
        uploadedAt: new Date().toISOString(),
        contentLength: contentText.length,
        processingMethod: processingMethod,
        isScanned: isScanned
      }
    });

    // Mark as processed
    await db.updateDocumentProcessed(document.id, true);

    // Clean up OCR temp files
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
});

// Ask question
app.post('/api/ask', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    const result = await geminiService.askQuestion(question.trim());

    res.json({
      success: true,
      question: question.trim(),
      answer: result.answer,
      relevantDocuments: result.relevantDocuments,
      responseTime: result.responseTime
    });

  } catch (error) {
    console.error('Error processing question:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Q&A history
app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const questions = await db.getQuestions(limit);
    res.json({ success: true, questions });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Summarize document
app.post('/api/summarize/:id', async (req, res) => {
  try {
    const documentId = req.params.id;
    const result = await geminiService.summarizeDocument(documentId);
    res.json({ success: true, summary: result });
  } catch (error) {
    console.error('Error summarizing document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search documents
app.get('/api/search', async (req, res) => {
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
});

// Extract key information
app.post('/api/extract', async (req, res) => {
  try {
    const { searchTerm } = req.body;
    
    if (!searchTerm || searchTerm.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Search term is required' });
    }

    const result = await geminiService.extractKeyInfo(searchTerm.trim());
    res.json({ success: true, result });

  } catch (error) {
    console.error('Error extracting key info:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete document
app.delete('/api/documents/:id', async (req, res) => {
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
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large' });
    }
  }
  
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📄 API Documentation available at http://localhost:${PORT}/health`);
      console.log(`💬 Ready to answer questions about your documents!`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 