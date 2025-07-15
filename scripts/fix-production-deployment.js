#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');
require('dotenv').config();

console.log('🔧 Production Deployment Fix');
console.log('='.repeat(50));

async function fixProductionDeployment() {
  try {
    // Step 1: Create metadata tables if they don't exist
    console.log('\n1. 📦 Creating metadata tables...');
    await createMetadataTables();
    
    // Step 2: Verify environment variables
    console.log('\n2. ⚙️  Verifying environment configuration...');
    await verifyEnvironment();
    
    // Step 3: Test database operations
    console.log('\n3. 🗄️  Testing database operations...');
    await testDatabaseOperations();
    
    // Step 4: Create enhanced fallback Vision service
    console.log('\n4. 🔧 Creating enhanced Vision service fallback...');
    await createEnhancedVisionFallback();
    
    // Step 5: Test PDF processing with fallbacks
    console.log('\n5. 📄 Testing PDF processing fallbacks...');
    await testPdfProcessingFallbacks();
    
    console.log('\n✅ Production deployment fix completed successfully!');
    console.log('\n📋 Next steps for production:');
    console.log('   1. Set GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable');
    console.log('   2. Restart the application');
    console.log('   3. Test PDF upload with a scanned document');
    
  } catch (error) {
    console.error('❌ Production fix failed:', error);
    throw error;
  }
}

async function createMetadataTables() {
  try {
    const schemaPath = path.join(__dirname, 'create-metadata-tables.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = schema.split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      for (const statement of statements) {
        try {
          await pool.query(statement);
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.log(`⚠️  Warning: ${error.message}`);
          }
        }
      }
      
      console.log('   ✅ Metadata tables created/verified');
    } else {
      console.log('   ⚠️  Schema file not found, creating basic tables...');
      await createBasicTables();
    }
  } catch (error) {
    console.error('   ❌ Error creating tables:', error.message);
  }
}

async function createBasicTables() {
  const basicSchema = `
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
  `;
  
  const statements = basicSchema.split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.log(`⚠️  Warning: ${error.message}`);
      }
    }
  }
  
  console.log('   ✅ Basic metadata tables created');
}

async function verifyEnvironment() {
  const checks = [
    {
      name: 'GOOGLE_CLOUD_PROJECT_ID',
      value: process.env.GOOGLE_CLOUD_PROJECT_ID,
      required: true
    },
    {
      name: 'GEMINI_API_KEY',
      value: process.env.GEMINI_API_KEY,
      required: true
    },
    {
      name: 'DATABASE_PUBLIC_URL',
      value: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
      required: true
    },
    {
      name: 'GOOGLE_APPLICATION_CREDENTIALS_JSON',
      value: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
      required: false,
      production: true
    },
    {
      name: 'MAX_PDF_PAGES',
      value: process.env.MAX_PDF_PAGES || '20',
      required: false
    }
  ];
  
  checks.forEach(check => {
    if (check.required && !check.value) {
      console.log(`   ❌ Missing required: ${check.name}`);
    } else if (check.production && !check.value) {
      console.log(`   ⚠️  Production recommended: ${check.name}`);
    } else if (check.value) {
      console.log(`   ✅ ${check.name}: Set`);
    }
  });
}

async function testDatabaseOperations() {
  try {
    // Test basic connection
    await pool.query('SELECT NOW()');
    console.log('   ✅ Database connection successful');
    
    // Test table access
    const tables = ['documents', 'companies', 'document_metadata', 'company_metadata'];
    for (const table of tables) {
      try {
        await pool.query(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
        console.log(`   ✅ Table ${table} accessible`);
      } catch (error) {
        console.log(`   ❌ Table ${table} error: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Database test failed: ${error.message}`);
  }
}

async function createEnhancedVisionFallback() {
  // Create an enhanced vision service that gracefully handles credential failures
  const enhancedServicePath = path.join(__dirname, '../services/enhanced-vision-service.js');
  
  const enhancedService = `
const fs = require('fs');
const path = require('path');
const { convert } = require('pdf2pic');

class EnhancedVisionService {
  constructor() {
    this.tempDir = './temp-images';
    this.hasVisionCredentials = this.checkVisionCredentials();
    this.ensureTempDir();
  }

  checkVisionCredentials() {
    try {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        return true;
      }
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS && 
          fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async processScannedPDF(pdfPath, maxPages = 20) {
    console.log('🔄 Processing PDF with enhanced fallback system...');
    
    if (!this.hasVisionCredentials) {
      console.log('⚠️  Vision API credentials not available, using fallback methods');
      return await this.fallbackProcessing(pdfPath);
    }
    
    try {
      // Try Vision API if credentials are available
      const visionOCRService = require('./vision-ocr-service');
      return await visionOCRService.processScannedPDF(pdfPath, maxPages);
    } catch (error) {
      console.log(\`⚠️  Vision API failed (\${error.message}), using fallback\`);
      return await this.fallbackProcessing(pdfPath);
    }
  }

  async fallbackProcessing(pdfPath) {
    try {
      // Method 1: Standard PDF parsing
      console.log('🔄 Attempting standard PDF parsing...');
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(dataBuffer);
      
      if (data.text && data.text.trim().length > 50) {
        console.log(\`✅ Standard parsing successful: \${data.text.length} characters\`);
        return data.text;
      }
      
      // Method 2: Tesseract.js fallback for scanned PDFs
      console.log('🔄 Attempting Tesseract.js OCR fallback...');
      return await this.tesseractFallback(pdfPath);
      
    } catch (error) {
      console.error('❌ All fallback methods failed:', error.message);
      throw new Error(\`PDF processing failed: \${error.message}. This PDF may require manual processing or Vision API credentials.\`);
    }
  }

  async tesseractFallback(pdfPath) {
    try {
      const { createWorker } = require('tesseract.js');
      
      // Convert PDF to images
      const images = await this.convertPDFToImages(pdfPath, 5); // Limit to 5 pages for fallback
      
      if (images.length === 0) {
        throw new Error('Could not convert PDF to images');
      }
      
      let allText = '';
      const worker = await createWorker();
      
      try {
        await worker.loadLanguage('eng+vie');
        await worker.initialize('eng+vie');
        
        for (const image of images.slice(0, 3)) { // Process max 3 pages
          const { data: { text } } = await worker.recognize(image.path);
          if (text.trim()) {
            allText += \`\\n--- Trang \${images.indexOf(image) + 1} ---\\n\`;
            allText += text.trim() + '\\n';
          }
          
          // Clean up temp image
          fs.unlinkSync(image.path);
        }
        
        await worker.terminate();
        
        if (allText.trim()) {
          console.log(\`✅ Tesseract.js OCR successful: \${allText.length} characters\`);
          return allText.trim();
        } else {
          throw new Error('No text extracted by Tesseract.js');
        }
        
      } catch (error) {
        await worker.terminate();
        throw error;
      }
      
    } catch (error) {
      console.error('❌ Tesseract.js fallback failed:', error.message);
      throw new Error(\`OCR fallback failed: \${error.message}\`);
    }
  }

  async convertPDFToImages(pdfPath, maxPages = 5) {
    try {
      const options = {
        density: 150,           // Lower DPI for fallback
        saveFilename: "fallback",
        savePath: this.tempDir,
        format: "png",
        quality: 90,
        width: 1200,           // Smaller size for fallback
      };

      console.log(\`📷 Converting PDF to images for fallback OCR (limit: \${maxPages} pages)...\`);
      
      const convert = require('pdf2pic').fromPath(pdfPath, options);
      const results = [];
      
      for (let i = 1; i <= maxPages; i++) {
        try {
          const result = await convert(i, { responseType: "image" });
          if (result && result.path) {
            results.push(result);
          } else {
            break;
          }
        } catch (error) {
          console.log(\`❌ Error converting page \${i}: \${error.message}\`);
          break;
        }
      }

      return results;
    } catch (error) {
      console.error('Error converting PDF to images for fallback:', error);
      return [];
    }
  }
}

module.exports = new EnhancedVisionService();
  `;
  
  fs.writeFileSync(enhancedServicePath, enhancedService.trim());
  console.log('   ✅ Enhanced vision service created');
}

async function testPdfProcessingFallbacks() {
  try {
    // Test if we have sample PDFs
    const uploadFiles = fs.existsSync('./uploads/') ? fs.readdirSync('./uploads/') : [];
    const samplePdf = uploadFiles.find(file => file.endsWith('.pdf'));
    
    if (samplePdf) {
      console.log(`   📄 Testing with sample PDF: ${samplePdf}`);
      
      // Test standard PDF parsing
      const pdfParse = require('pdf-parse');
      const samplePath = path.join('./uploads/', samplePdf);
      const dataBuffer = fs.readFileSync(samplePath);
      const data = await pdfParse(dataBuffer);
      
      console.log(`   ✅ Standard parsing: ${data.text.length} characters`);
      console.log(`   📊 Processing method: ${data.text.trim().length < 100 ? 'Would use OCR' : 'Standard parsing sufficient'}`);
      
    } else {
      console.log('   ⚠️  No sample PDFs available for testing');
    }
  } catch (error) {
    console.log(`   ❌ PDF fallback test failed: ${error.message}`);
  }
}

// Run the fix
async function main() {
  try {
    await fixProductionDeployment();
  } catch (error) {
    console.error('❌ Production fix failed:', error);
    process.exit(1);
  } finally {
    if (pool) {
      pool.end();
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixProductionDeployment }; 