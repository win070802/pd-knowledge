#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// Database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function setupCrossValidation() {
  console.log('🚀 Setting up Cross-Document Validation System...\n');
  
  try {
    // Step 1: Create metadata tables
    console.log('📦 Creating metadata tables...');
    const schemaPath = path.join(__dirname, 'create-metadata-tables.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(schema);
    console.log('✅ Metadata tables created successfully\n');
    
    // Step 2: Verify tables exist
    console.log('🔍 Verifying tables...');
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('document_metadata', 'company_metadata', 'validation_logs', 'entity_references')
      ORDER BY table_name
    `;
    
    const result = await pool.query(tablesQuery);
    console.log('📋 Found tables:', result.rows.map(r => r.table_name));
    
    if (result.rows.length === 4) {
      console.log('✅ All validation tables created successfully\n');
    } else {
      console.log('⚠️  Some tables missing. Expected 4, found:', result.rows.length);
    }
    
    // Step 3: Check existing documents for validation
    console.log('📚 Checking existing documents...');
    const documentsQuery = 'SELECT COUNT(*) as count FROM documents';
    const docsResult = await pool.query(documentsQuery);
    const documentCount = parseInt(docsResult.rows[0].count);
    
    console.log(`📄 Found ${documentCount} existing documents`);
    
    if (documentCount > 0) {
      console.log('💡 Existing documents will be processed for cross-validation on next upload');
      console.log('🔄 To retroactively process existing documents, use: npm run process-existing-docs');
    }
    
    // Step 4: Test AI services
    console.log('\n🧠 Testing AI services...');
    
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const testPrompt = 'Return JSON: {"status": "working", "message": "AI service ready"}';
      const result = await model.generateContent(testPrompt);
      const response = result.response.text();
      
      console.log('✅ Gemini AI service working');
      console.log('🤖 Response sample:', response.substring(0, 100) + '...');
      
    } catch (aiError) {
      console.log('❌ AI service test failed:', aiError.message);
      console.log('⚠️  Cross-validation will use fallback mechanisms');
    }
    
    console.log('\n🎉 Cross-Document Validation System Setup Complete!');
    console.log('\n📋 What happens next:');
    console.log('1. ✅ When you upload new PDFs, they will be:');
    console.log('   • Analyzed for entities (names, positions, policies)');
    console.log('   • Cross-validated against existing documents');
    console.log('   • OCR errors will be corrected automatically');
    console.log('   • Standardized metadata will be generated');
    console.log('');
    console.log('2. 🔍 You can query entities with:');
    console.log('   • GET /api/companies/:companyId/metadata');
    console.log('   • Search entities across documents');
    console.log('   • View validation logs');
    console.log('');
    console.log('3. 📊 Benefits:');
    console.log('   • Consistent company data across documents');
    console.log('   • Automatic OCR error correction');
    console.log('   • Smart entity extraction and standardization');
    console.log('   • Cross-document information validation');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Example usage demonstration
async function demonstrateFeatures() {
  console.log('\n🎯 Example: How Cross-Validation Works');
  console.log('');
  console.log('📄 Document A: "CEO: Lê Nguyên Hoàng Min" (OCR error)');
  console.log('📄 Document B: "CEO: Lê Nguyễn Hoàng Minh" (correct)');
  console.log('📄 Document C: "Giám đốc: Lê Nguyễn Hoàng Minh" (correct)');
  console.log('');
  console.log('🧠 AI Analysis:');
  console.log('• Detects "Lê Nguyên Hoàng Min" vs "Lê Nguyễn Hoàng Minh"');
  console.log('• Finds evidence in Documents B & C');
  console.log('• Confidence: 95% that correct name is "Lê Nguyễn Hoàng Minh"');
  console.log('');
  console.log('✅ Result:');
  console.log('• Document A text corrected automatically');
  console.log('• Standardized metadata: CEO = "Lê Nguyễn Hoàng Minh"');
  console.log('• All future documents use consistent data');
  console.log('• Validation logged for audit trail');
}

if (require.main === module) {
  setupCrossValidation()
    .then(() => demonstrateFeatures())
    .catch(console.error);
}

module.exports = setupCrossValidation; 