#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import our services
const visionOCRService = require('./services/vision-ocr-service');
const { db } = require('./database');
// Add direct database connection for queries
const { pool } = require('./src/config/database');

async function testProductionIssues() {
  console.log('🔍 Testing Production Issues - PDF Upload Diagnosis');
  console.log('='.repeat(60));
  
  // Test 1: Environment Variables
  console.log('\n1. Environment Variables Check:');
  const requiredEnvVars = [
    'GOOGLE_CLOUD_PROJECT_ID',
    'GEMINI_API_KEY',
    'DATABASE_PUBLIC_URL'
  ];
  
  const optionalEnvVars = [
    'GOOGLE_APPLICATION_CREDENTIALS',
    'GOOGLE_APPLICATION_CREDENTIALS_JSON',
    'MAX_PDF_PAGES'
  ];
  
  console.log('Required variables:');
  requiredEnvVars.forEach(varName => {
    const value = process.env[varName];
    console.log(`  ${varName}: ${value ? '✅ Set' : '❌ Missing'}`);
  });
  
  console.log('Optional variables:');
  optionalEnvVars.forEach(varName => {
    const value = process.env[varName];
    console.log(`  ${varName}: ${value ? '✅ Set' : '⚠️  Not set'}`);
  });
  
  // Test 2: Google Cloud Vision Setup
  console.log('\n2. Google Cloud Vision Configuration:');
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      console.log('  ✅ Using JSON credentials for production');
      try {
        const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        console.log(`  📧 Service account: ${creds.client_email || 'Unknown'}`);
        console.log(`  🏢 Project ID: ${creds.project_id || 'Unknown'}`);
      } catch (e) {
        console.log('  ❌ Invalid JSON credentials format');
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log('  ✅ Using keyFilename for development');
      const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      console.log(`  📄 Key file: ${fs.existsSync(keyFile) ? '✅ Exists' : '❌ Not found'}`);
    } else {
      console.log('  ❌ No Google Cloud credentials configured');
    }
  } catch (error) {
    console.log(`  ❌ Error checking credentials: ${error.message}`);
  }
  
  // Test 3: Database Connection
  console.log('\n3. Database Connection:');
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('  ✅ Database connection successful');
  } catch (error) {
    console.log(`  ❌ Database connection failed: ${error.message}`);
  }
  
  // Test 4: Metadata Tables
  console.log('\n4. Metadata Tables Check:');
  try {
    const tables = ['document_metadata', 'company_metadata', 'validation_logs', 'entity_references'];
    for (const table of tables) {
      try {
        await pool.query(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
        console.log(`  ✅ Table ${table} exists`);
      } catch (error) {
        console.log(`  ❌ Table ${table} missing or inaccessible`);
      }
    }
  } catch (error) {
    console.log(`  ❌ Error checking tables: ${error.message}`);
  }
  
  // Test 5: PDF Processing Capabilities
  console.log('\n5. PDF Processing Test:');
  try {
    const testPdfPath = path.join(__dirname, 'data', 'simple-pdh-info.txt');
    
    // Check if we have any sample PDFs
    const uploadFiles = fs.existsSync('./uploads/') ? fs.readdirSync('./uploads/') : [];
    const samplePdf = uploadFiles.find(file => file.endsWith('.pdf'));
    
    if (samplePdf) {
      console.log(`  📄 Found sample PDF: ${samplePdf}`);
      const samplePath = path.join('./uploads/', samplePdf);
      
      try {
        console.log('  🔄 Testing PDF processing (without Vision API)...');
        
        // Test only standard PDF parsing to avoid Vision API errors
        const fs = require('fs');
        const pdfParse = require('pdf-parse');
        const dataBuffer = fs.readFileSync(samplePath);
        const data = await pdfParse(dataBuffer);
        
        console.log(`  ✅ Standard PDF parsing works`);
        console.log(`    - Text length: ${data.text.length} characters`);
        console.log(`    - Is likely scanned: ${data.text.trim().length < 100 ? 'Yes (would use Vision API)' : 'No (standard parsing)'}`);
        
      } catch (error) {
        console.log(`  ❌ PDF processing failed: ${error.message}`);
      }
    } else {
      console.log('  ⚠️  No sample PDFs found in uploads/ directory');
    }
  } catch (error) {
    console.log(`  ❌ Error in PDF test: ${error.message}`);
  }
  
  // Test 6: Vision API Direct Test
  console.log('\n6. Vision API Direct Test:');
  try {
    // Check if we have any test images
    if (!fs.existsSync('./temp-images/')) {
      fs.mkdirSync('./temp-images/', { recursive: true });
    }
    
    console.log('  ⚠️  Skipping Vision API direct test (requires actual image and credentials)');
    console.log('  💡 To test: Upload a scanned PDF to trigger Vision API');
    
  } catch (error) {
    console.log(`  ❌ Vision API test error: ${error.message}`);
  }
  
  // Test 7: Memory and Performance
  console.log('\n7. System Resources:');
  const usage = process.memoryUsage();
  console.log(`  💾 Memory usage: ${Math.round(usage.rss / 1024 / 1024)}MB RSS`);
  console.log(`  🧠 Heap used: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
  console.log(`  ⏱️  Uptime: ${Math.round(process.uptime())}s`);
  
  // Production Recommendations
  console.log('\n📋 Production Recommendations:');
  console.log('='.repeat(60));
  
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('❌ Configure Google Cloud credentials for Vision API');
  }
  
  if (!process.env.MAX_PDF_PAGES) {
    console.log('💡 Set MAX_PDF_PAGES=20 to limit processing for large PDFs');
  }
  
  if (!process.env.NODE_ENV) {
    console.log('💡 Set NODE_ENV=production for production deployment');
  }
  
  console.log('\n✅ Diagnosis completed. Check above for any ❌ errors that need fixing.');
}

// Enhanced error testing
async function simulateProductionError() {
  console.log('\n🧪 Simulating Production PDF Upload Error:');
  console.log('='.repeat(60));
  
  try {
    // Test the specific error: "No images extracted from PDF"
    const fakeImageResults = [];
    
    if (fakeImageResults.length === 0) {
      console.log('⚠️  Simulated: No images extracted from PDF');
      
      // Test fallback mechanism
      console.log('🔄 Testing fallback to standard PDF parsing...');
      
      try {
        const pdfParse = require('pdf-parse');
        console.log('✅ pdf-parse module available');
        
        // Simulate successful fallback
        console.log('✅ Fallback mechanism should work');
        console.log('💡 If production still fails, check:');
        console.log('   1. PDF file corruption during upload');
        console.log('   2. Memory limits in production environment');
        console.log('   3. Network timeouts for Vision API calls');
        console.log('   4. File permissions in production temp directories');
        console.log('   5. Missing GOOGLE_APPLICATION_CREDENTIALS_JSON in production');
        
      } catch (error) {
        console.log('❌ pdf-parse fallback not available:', error.message);
      }
    }
    
  } catch (error) {
    console.log('❌ Error in simulation:', error.message);
  }
}

// Run tests
async function main() {
  try {
    await testProductionIssues();
    await simulateProductionError();
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close database connection
    if (pool) {
      pool.end();
    }
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testProductionIssues, simulateProductionError }; 