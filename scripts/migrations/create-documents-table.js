const { pool } = require('../../src/config/database');

/**
 * Tạo bảng documents nếu chưa tồn tại
 */
async function createDocumentsTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Bắt đầu tạo bảng documents...');
    
    // Bắt đầu transaction
    await client.query('BEGIN');
    
    // Kiểm tra bảng documents đã tồn tại chưa
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'documents'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('ℹ️ Bảng documents đã tồn tại, bỏ qua bước tạo bảng');
    } else {
      // Tạo bảng documents
      await client.query(`
        CREATE TABLE documents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          filename VARCHAR(255) NOT NULL,
          original_name VARCHAR(500) NOT NULL,
          file_path VARCHAR(1000) NOT NULL,
          file_size BIGINT,
          page_count INTEGER,
          content_text TEXT,
          company_id UUID REFERENCES companies(id),
          category VARCHAR(100),
          metadata JSONB DEFAULT '{}',
          processed BOOLEAN DEFAULT false,
          processing_notes JSONB DEFAULT '{}',
          upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Tạo các indexes
      await client.query('CREATE INDEX idx_documents_filename ON documents(filename)');
      await client.query('CREATE INDEX idx_documents_original_name ON documents(original_name)');
      await client.query('CREATE INDEX idx_documents_company_id ON documents(company_id)');
      await client.query('CREATE INDEX idx_documents_category ON documents(category)');
      await client.query('CREATE INDEX idx_documents_processed ON documents(processed)');
      await client.query('CREATE INDEX idx_documents_upload_date ON documents(upload_date)');
      
      console.log('✅ Đã tạo bảng documents');
    }
    
    // Kiểm tra bảng document_chunks đã tồn tại chưa
    const chunksTableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'document_chunks'
      );
    `);
    
    if (chunksTableExists.rows[0].exists) {
      console.log('ℹ️ Bảng document_chunks đã tồn tại, bỏ qua bước tạo bảng');
    } else {
      // Tạo bảng document_chunks
      await client.query(`
        CREATE TABLE document_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
          chunk_text TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(document_id, chunk_index)
        )
      `);
      
      await client.query('CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id)');
      
      console.log('✅ Đã tạo bảng document_chunks');
    }
    
    // Tạo trigger để cập nhật thời gian updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_documents_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS documents_update_timestamp ON documents;
      CREATE TRIGGER documents_update_timestamp
          BEFORE UPDATE ON documents
          FOR EACH ROW
          EXECUTE FUNCTION update_documents_timestamp();
    `);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Đã hoàn thành việc tạo bảng documents');
    
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi tạo bảng documents:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Thực thi hàm
createDocumentsTable()
  .then(() => {
    console.log('🎉 Quá trình tạo bảng documents hoàn tất thành công');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Quá trình tạo bảng documents thất bại:', error);
    process.exit(1);
  }); 