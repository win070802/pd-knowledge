const { pool } = require('../../src/config/database');

/**
 * Tạo lại bảng knowledge_base
 */
async function createKnowledgeBaseTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Bắt đầu tạo lại bảng knowledge_base...');
    
    // Bắt đầu transaction
    await client.query('BEGIN');
    
    // Xóa bảng knowledge_base nếu tồn tại
    console.log('🗑️ Đang xóa bảng knowledge_base nếu tồn tại...');
    await client.query('DROP TABLE IF EXISTS knowledge_base CASCADE');
    console.log('✅ Đã xóa bảng knowledge_base');
    
    // Tạo bảng knowledge_base mới
    console.log('📊 Đang tạo bảng knowledge_base mới...');
    
    await client.query(`
      CREATE TABLE knowledge_base (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NULL REFERENCES companies(id),
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        keywords TEXT[] NULL,
        category VARCHAR(255) NULL,
        is_active BOOLEAN NULL DEFAULT true,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB NULL
      )
    `);
    console.log('✅ Đã tạo bảng knowledge_base');
    
    // Tạo các indexes
    console.log('📊 Đang tạo các indexes...');
    
    await client.query('CREATE INDEX idx_knowledge_base_company ON knowledge_base(company_id)');
    await client.query('CREATE INDEX idx_knowledge_base_category ON knowledge_base(category)');
    await client.query('CREATE INDEX idx_knowledge_base_active ON knowledge_base(is_active)');
    await client.query('CREATE INDEX idx_knowledge_base_keywords ON knowledge_base USING GIN(keywords)');
    await client.query('CREATE INDEX idx_knowledge_base_metadata ON knowledge_base USING GIN(metadata)');
    
    // Tạo trigger để tự động cập nhật thời gian
    console.log('🔄 Đang tạo trigger cập nhật thời gian...');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION update_knowledge_base_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE TRIGGER knowledge_base_update_timestamp
          BEFORE UPDATE ON knowledge_base
          FOR EACH ROW
          EXECUTE FUNCTION update_knowledge_base_timestamp();
    `);
    
    // Thêm dữ liệu mẫu
    console.log('📝 Đang thêm dữ liệu mẫu...');
    
    await client.query(`
      INSERT INTO knowledge_base (
        company_id,
        question,
        answer,
        keywords,
        category,
        is_active,
        metadata
      ) VALUES (
        (SELECT id FROM companies WHERE company_code = 'PDH'),
        'Quy trình phê duyệt hợp đồng mua bán gồm những bước nào?',
        'Quy trình phê duyệt hợp đồng mua bán của Phát Đạt Holdings bao gồm 6 bước:
        
        1. Soạn thảo hợp đồng: Phòng Pháp chế soạn thảo hợp đồng theo mẫu.
        2. Xem xét nội dung: Trưởng phòng Pháp chế xem xét nội dung.
        3. Phê duyệt cấp 1: Giám đốc Tài chính phê duyệt.
        4. Phê duyệt cấp 2: Tổng Giám đốc phê duyệt.
        5. Ký kết: Các bên ký kết hợp đồng.
        6. Lưu trữ: Hợp đồng được lưu trữ vào hệ thống quản lý tài liệu.',
        
        ARRAY['hợp đồng mua bán', 'phê duyệt hợp đồng', 'quy trình phê duyệt', 'Phát Đạt Holdings'],
        
        'Quy trình',
        
        TRUE,
        
        '{"approvalLevels": 2, "requiredSignatures": ["Giám đốc Tài chính", "Tổng Giám đốc"], "averageProcessingTime": "5 ngày làm việc", "relatedDocuments": ["Quy chế mua bán", "Mẫu hợp đồng tiêu chuẩn"]}'
      )
    `);
    
    // Thêm một số câu hỏi khác
    await client.query(`
      INSERT INTO knowledge_base (
        company_id,
        question,
        answer,
        keywords,
        category,
        is_active
      ) VALUES 
      (
        (SELECT id FROM companies WHERE company_code = 'PDH'),
        'Ai là người phê duyệt cuối cùng trong quy trình hợp đồng mua bán?',
        'Tổng Giám đốc là người phê duyệt cuối cùng (cấp 2) trong quy trình phê duyệt hợp đồng mua bán tại Phát Đạt Holdings.',
        ARRAY['hợp đồng', 'phê duyệt', 'Tổng Giám đốc'],
        'Quy trình',
        TRUE
      ),
      (
        (SELECT id FROM companies WHERE company_code = 'PDH'),
        'Phòng ban nào chịu trách nhiệm soạn thảo hợp đồng mua bán?',
        'Phòng Pháp chế chịu trách nhiệm soạn thảo hợp đồng mua bán theo mẫu tại Phát Đạt Holdings.',
        ARRAY['hợp đồng', 'soạn thảo', 'Phòng Pháp chế'],
        'Quy trình',
        TRUE
      )
    `);
    
    console.log('✅ Đã thêm dữ liệu mẫu cho knowledge_base');
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Đã hoàn thành việc tạo lại bảng knowledge_base');
    
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi tạo lại bảng knowledge_base:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Thực thi hàm
createKnowledgeBaseTable()
  .then(() => {
    console.log('🎉 Quá trình tạo lại bảng knowledge_base hoàn tất thành công');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Quá trình tạo lại bảng knowledge_base thất bại:', error);
    process.exit(1);
  }); 