const { pool } = require('../../src/config/database');

/**
 * Tạo lại bảng knowledge
 */
async function createKnowledgeTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Bắt đầu tạo lại bảng knowledge...');
    
    // Bắt đầu transaction
    await client.query('BEGIN');
    
    // Xóa bảng knowledge nếu tồn tại
    console.log('🗑️ Đang xóa bảng knowledge nếu tồn tại...');
    await client.query('DROP TABLE IF EXISTS knowledge_questions CASCADE');
    await client.query('DROP TABLE IF EXISTS knowledge CASCADE');
    console.log('✅ Đã xóa bảng knowledge');
    
    // Tạo bảng knowledge mới
    console.log('📊 Đang tạo bảng knowledge mới...');
    
    await client.query(`
      CREATE TABLE knowledge (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Thông tin cơ bản
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        
        -- Phân loại và phân nhóm
        category VARCHAR(100),
        tags TEXT[],
        keywords TEXT[],
        
        -- Liên kết với công ty
        company_id UUID REFERENCES companies(id),
        department VARCHAR(100),
        
        -- Thông tin người tạo và thời gian
        created_by VARCHAR(100),
        updated_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        -- Trạng thái và kiểm soát
        is_active BOOLEAN DEFAULT TRUE,
        is_public BOOLEAN DEFAULT FALSE,
        view_count INTEGER DEFAULT 0,
        
        -- Liên kết với tài liệu
        source_document_ids UUID[],
        related_knowledge_ids UUID[],
        
        -- Dữ liệu tìm kiếm - Sử dụng các trường riêng biệt thay vì tsvector
        search_title TEXT,
        search_content TEXT,
        search_keywords TEXT,
        
        -- Dữ liệu cho Q&A
        question_patterns TEXT[],
        content_embedding VECTOR(1536), -- Embedding cho nội dung
        
        -- Metadata bổ sung
        metadata JSONB DEFAULT '{}'
      )
    `);
    console.log('✅ Đã tạo bảng knowledge');
    
    // Tạo bảng knowledge_questions để lưu trữ các câu hỏi và embeddings
    console.log('📊 Đang tạo bảng knowledge_questions...');
    
    await client.query(`
      CREATE TABLE knowledge_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        knowledge_id UUID REFERENCES knowledge(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        question_embedding VECTOR(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Đã tạo bảng knowledge_questions');
    
    // Tạo các indexes
    console.log('📊 Đang tạo các indexes...');
    
    await client.query('CREATE INDEX idx_knowledge_company ON knowledge(company_id)');
    await client.query('CREATE INDEX idx_knowledge_category ON knowledge(category)');
    await client.query('CREATE INDEX idx_knowledge_active ON knowledge(is_active)');
    await client.query('CREATE INDEX idx_knowledge_created_at ON knowledge(created_at)');
    await client.query('CREATE INDEX idx_knowledge_tags ON knowledge USING GIN(tags)');
    await client.query('CREATE INDEX idx_knowledge_keywords ON knowledge USING GIN(keywords)');
    
    // Index cho tìm kiếm văn bản
    await client.query('CREATE INDEX idx_knowledge_search_title ON knowledge(search_title)');
    await client.query('CREATE INDEX idx_knowledge_search_content ON knowledge(search_content)');
    await client.query('CREATE INDEX idx_knowledge_search_keywords ON knowledge(search_keywords)');
    
    // Index cho metadata
    await client.query('CREATE INDEX idx_knowledge_metadata ON knowledge USING GIN(metadata)');
    
    // Index cho knowledge_questions
    await client.query('CREATE INDEX idx_knowledge_questions_knowledge_id ON knowledge_questions(knowledge_id)');
    
    // Tạo trigger để tự động cập nhật thời gian
    console.log('🔄 Đang tạo trigger cập nhật thời gian...');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION update_knowledge_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE TRIGGER knowledge_update_timestamp
          BEFORE UPDATE ON knowledge
          FOR EACH ROW
          EXECUTE FUNCTION update_knowledge_timestamp();
    `);
    
    // Tạo trigger để tự động cập nhật search fields
    console.log('🔄 Đang tạo trigger cập nhật search fields...');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION knowledge_search_fields_update()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_title = lower(COALESCE(NEW.title, ''));
        NEW.search_content = lower(COALESCE(NEW.content, '')) || ' ' || lower(COALESCE(NEW.summary, ''));
        NEW.search_keywords = lower(COALESCE(array_to_string(NEW.keywords, ' '), '')) || ' ' || 
                             lower(COALESCE(array_to_string(NEW.tags, ' '), ''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE TRIGGER knowledge_search_fields_update_trigger
        BEFORE INSERT OR UPDATE ON knowledge
        FOR EACH ROW
        EXECUTE FUNCTION knowledge_search_fields_update();
    `);
    
    // Thêm dữ liệu mẫu
    console.log('📝 Đang thêm dữ liệu mẫu...');
    
    const knowledgeInsertResult = await client.query(`
      INSERT INTO knowledge (
        title, 
        content, 
        summary, 
        category, 
        tags, 
        keywords, 
        company_id, 
        department, 
        created_by, 
        is_public,
        metadata
      ) VALUES (
        'Quy trình phê duyệt hợp đồng mua bán',
        'Quy trình phê duyệt hợp đồng mua bán của Phát Đạt Holdings bao gồm các bước sau:
        
        1. Soạn thảo hợp đồng: Phòng Pháp chế soạn thảo hợp đồng theo mẫu.
        2. Xem xét nội dung: Trưởng phòng Pháp chế xem xét nội dung.
        3. Phê duyệt cấp 1: Giám đốc Tài chính phê duyệt.
        4. Phê duyệt cấp 2: Tổng Giám đốc phê duyệt.
        5. Ký kết: Các bên ký kết hợp đồng.
        6. Lưu trữ: Hợp đồng được lưu trữ vào hệ thống quản lý tài liệu.',
        
        'Quy trình 6 bước phê duyệt hợp đồng mua bán từ soạn thảo đến lưu trữ tại Phát Đạt Holdings',
        
        'Quy trình',
        
        ARRAY['hợp đồng', 'phê duyệt', 'quy trình'],
        
        ARRAY['hợp đồng mua bán', 'phê duyệt hợp đồng', 'quy trình phê duyệt', 'Phát Đạt Holdings'],
        
        (SELECT id FROM companies WHERE company_code = 'PDH'),
        
        'Ban Pháp chế',
        
        'system',
        
        TRUE,
        
        '{"approvalLevels": 2, "requiredSignatures": ["Giám đốc Tài chính", "Tổng Giám đốc"], "averageProcessingTime": "5 ngày làm việc", "relatedDocuments": ["Quy chế mua bán", "Mẫu hợp đồng tiêu chuẩn"]}'
      ) RETURNING id
    `);
    
    // Thêm câu hỏi mẫu cho knowledge
    if (knowledgeInsertResult.rows.length > 0) {
      const knowledgeId = knowledgeInsertResult.rows[0].id;
      
      await client.query(`
        INSERT INTO knowledge_questions (
          knowledge_id,
          question
        ) VALUES 
        ($1, 'Quy trình phê duyệt hợp đồng mua bán gồm những bước nào?'),
        ($1, 'Ai là người phê duyệt cuối cùng trong quy trình hợp đồng mua bán?'),
        ($1, 'Phòng ban nào chịu trách nhiệm soạn thảo hợp đồng mua bán?')
      `, [knowledgeId]);
      
      console.log('✅ Đã thêm câu hỏi mẫu cho knowledge');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Đã hoàn thành việc tạo lại bảng knowledge');
    
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi tạo lại bảng knowledge:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Thực thi hàm
createKnowledgeTable()
  .then(() => {
    console.log('🎉 Quá trình tạo lại bảng knowledge hoàn tất thành công');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Quá trình tạo lại bảng knowledge thất bại:', error);
    process.exit(1);
  }); 