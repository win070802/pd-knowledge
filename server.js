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
const storageService = require('./storage-service');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create temp directory for file processing
const tempDir = './temp';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
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
    cb(null, './uploads');
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

    const tempFilePath = req.file.path;
    const fileName = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    // Extract text from PDF (with OCR support for scanned PDFs)
    const contentText = await extractTextFromPDF(tempFilePath);

    // Upload to storage (cloud or local)
    const storageResult = await storageService.uploadFile(tempFilePath, fileName);

    // Determine processing method
    const isScanned = ocrService.isScannedPDF(contentText);
    const processingMethod = isScanned ? 'OCR' : 'Standard';

    // Save document to database
    const document = await db.createDocument({
      filename: fileName,
      originalName: originalName,
      filePath: storageResult.path,
      fileSize: fileSize,
      content: contentText,
      metadata: {
        uploadedAt: new Date().toISOString(),
        contentLength: contentText.length,
        processingMethod: processingMethod,
        isScanned: isScanned,
        storageType: storageResult.storage,
        storageUrl: storageResult.url
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

// Constraint Management Endpoints

// Get all constraints
app.get('/api/constraints', async (req, res) => {
  try {
    const constraints = geminiService.getConstraints();
    res.json({ success: true, data: constraints });
  } catch (error) {
    console.error('Error getting constraints:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add or update constraint
app.post('/api/constraints', async (req, res) => {
  try {
    const { question, answer } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question and answer are required' 
      });
    }

    const success = geminiService.addConstraint(question, answer);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Constraint added successfully',
        data: { question, answer }
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to add constraint' 
      });
    }
  } catch (error) {
    console.error('Error adding constraint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete constraint
app.delete('/api/constraints', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question is required' 
      });
    }

    const success = geminiService.removeConstraint(question);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Constraint removed successfully',
        data: { question }
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Constraint not found' 
      });
    }
  } catch (error) {
    console.error('Error removing constraint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Company Management Endpoints

// Get all companies
app.get('/api/companies', async (req, res) => {
  try {
    const companies = await db.getCompanies();
    res.json({ success: true, data: companies });
  } catch (error) {
    console.error('Error getting companies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get company by code
app.get('/api/companies/:code', async (req, res) => {
  try {
    const company = await db.getCompanyByCode(req.params.code.toUpperCase());
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }
    res.json({ success: true, data: company });
  } catch (error) {
    console.error('Error getting company:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create company
app.post('/api/companies', async (req, res) => {
  try {
    const { code, fullName, parentGroup, chairman, ceo, description, keywords } = req.body;
    
    if (!code || !fullName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Code and full name are required' 
      });
    }

    const company = await db.createCompany({
      code: code.toUpperCase(),
      fullName,
      parentGroup,
      chairman,
      ceo,
      description,
      keywords
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Company created successfully',
      data: company
    });
  } catch (error) {
    console.error('Error creating company:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ success: false, error: 'Company code already exists' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// Update company
app.put('/api/companies/:id', async (req, res) => {
  try {
    const { fullName, parentGroup, chairman, ceo, description, keywords } = req.body;
    
    const company = await db.updateCompany(req.params.id, {
      fullName,
      parentGroup,
      chairman,
      ceo,
      description,
      keywords
    });
    
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Company updated successfully',
      data: company
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete company
app.delete('/api/companies/:id', async (req, res) => {
  try {
    const success = await db.deleteCompany(req.params.id);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Company deleted successfully'
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Company not found' 
      });
    }
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Sensitive Rules Management Endpoints

// Get all sensitive rules
app.get('/api/sensitive-rules', async (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const rules = await db.getSensitiveRules(activeOnly);
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('Error getting sensitive rules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create sensitive rule
app.post('/api/sensitive-rules', async (req, res) => {
  try {
    const { ruleName, pattern, description, isActive = true } = req.body;
    
    if (!ruleName || !pattern) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rule name and pattern are required' 
      });
    }

    // Test regex pattern
    try {
      new RegExp(pattern, 'i');
    } catch (regexError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid regex pattern' 
      });
    }

    const rule = await db.createSensitiveRule({
      ruleName,
      pattern,
      description,
      isActive
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Sensitive rule created successfully',
      data: rule
    });
  } catch (error) {
    console.error('Error creating sensitive rule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update sensitive rule
app.put('/api/sensitive-rules/:id', async (req, res) => {
  try {
    const { ruleName, pattern, description, isActive } = req.body;
    
    // Test regex pattern if provided
    if (pattern) {
      try {
        new RegExp(pattern, 'i');
      } catch (regexError) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid regex pattern' 
        });
      }
    }

    const rule = await db.updateSensitiveRule(req.params.id, {
      ruleName,
      pattern,
      description,
      isActive
    });
    
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Sensitive rule updated successfully',
      data: rule
    });
  } catch (error) {
    console.error('Error updating sensitive rule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete sensitive rule
app.delete('/api/sensitive-rules/:id', async (req, res) => {
  try {
    const success = await db.deleteSensitiveRule(req.params.id);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Sensitive rule deleted successfully'
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Rule not found' 
      });
    }
  } catch (error) {
    console.error('Error deleting sensitive rule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Knowledge Base Management Endpoints

// Get knowledge entries by company
app.get('/api/knowledge/company/:companyId', async (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const knowledge = await db.getKnowledgeByCompany(req.params.companyId, activeOnly);
    res.json({ success: true, data: knowledge });
  } catch (error) {
    console.error('Error getting knowledge by company:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search knowledge base
app.get('/api/knowledge/search', async (req, res) => {
  try {
    const { q: searchTerm, company_id: companyId } = req.query;
    
    if (!searchTerm) {
      return res.status(400).json({ 
        success: false, 
        error: 'Search term is required' 
      });
    }

    const knowledge = await db.searchKnowledge(searchTerm, companyId);
    res.json({ success: true, data: knowledge });
  } catch (error) {
    console.error('Error searching knowledge:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create knowledge entry
app.post('/api/knowledge', async (req, res) => {
  try {
    const { companyId, question, answer, keywords, category, isActive = true } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question and answer are required' 
      });
    }

    const knowledge = await db.createKnowledge({
      companyId,
      question,
      answer,
      keywords,
      category,
      isActive
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Knowledge entry created successfully',
      data: knowledge
    });
  } catch (error) {
    console.error('Error creating knowledge:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update knowledge entry
app.put('/api/knowledge/:id', async (req, res) => {
  try {
    const { question, answer, keywords, category, isActive } = req.body;

    const knowledge = await db.updateKnowledge(req.params.id, {
      question,
      answer,
      keywords,
      category,
      isActive
    });
    
    if (!knowledge) {
      return res.status(404).json({ success: false, error: 'Knowledge entry not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Knowledge entry updated successfully',
      data: knowledge
    });
  } catch (error) {
    console.error('Error updating knowledge:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete knowledge entry
app.delete('/api/knowledge/:id', async (req, res) => {
  try {
    const success = await db.deleteKnowledge(req.params.id);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Knowledge entry deleted successfully'
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Knowledge entry not found' 
      });
    }
  } catch (error) {
    console.error('Error deleting knowledge:', error);
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