const { pool } = require('../../src/config/database');
const fs = require('fs');
const path = require('path');

/**
 * Tạo các bảng metadata cho cross-document validation
 */
async function createMetadataTables(client) {
  console.log('📊 Đang tạo các bảng metadata...');
  
  // Kiểm tra xem file SQL có tồn tại không
  const sqlPath = path.join(__dirname, '../create-metadata-tables.sql');
  
  if (fs.existsSync(sqlPath)) {
    console.log('📄 Đang sử dụng file SQL để tạo bảng metadata...');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('✅ Đã tạo bảng metadata từ file SQL');
  } else {
    console.log('⚠️ Không tìm thấy file SQL, sử dụng SQL inline...');
    
    // Document metadata table
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_metadata (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        entities JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(document_id)
      )
    `);
    console.log('✅ Đã đảm bảo bảng document_metadata');

    // Company metadata table
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_metadata (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id)
      )
    `);
    console.log('✅ Đã đảm bảo bảng company_metadata');

    // Validation logs table
    await client.query(`
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
      )
    `);
    console.log('✅ Đã đảm bảo bảng validation_logs');

    // Entity references table
    await client.query(`
      CREATE TABLE IF NOT EXISTS entity_references (
        id SERIAL PRIMARY KEY,
        entity_name VARCHAR(255) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        confidence DECIMAL(3,2) DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Đã đảm bảo bảng entity_references');

    // Indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_document_metadata_document_id ON document_metadata(document_id);
      CREATE INDEX IF NOT EXISTS idx_company_metadata_company_id ON company_metadata(company_id);
      CREATE INDEX IF NOT EXISTS idx_validation_logs_document_id ON validation_logs(document_id);
      CREATE INDEX IF NOT EXISTS idx_entity_references_company_id ON entity_references(company_id);
      CREATE INDEX IF NOT EXISTS idx_entity_references_entity_name ON entity_references(entity_name);
    `);
    console.log('✅ Đã tạo các index cho bảng metadata');
  }
}

module.exports = { createMetadataTables }; 