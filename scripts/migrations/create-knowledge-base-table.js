const { pool } = require('../../src/config/database');

/**
 * Tạo bảng knowledge_base nếu chưa tồn tại
 */
async function createKnowledgeBaseTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Bắt đầu tạo bảng knowledge_base...');
    
    // Bắt đầu transaction
    await client.query('BEGIN');
    
    // Kiểm tra bảng knowledge_base đã tồn tại chưa
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'knowledge_base'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('ℹ️ Bảng knowledge_base đã tồn tại, bỏ qua bước tạo bảng');
    } else {
      // Tạo bảng knowledge_base
      await client.query(`
        CREATE TABLE knowledge_base (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          company_id UUID REFERENCES companies(id),
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
      
      // Tạo indexes cho knowledge_base
      await client.query('CREATE INDEX idx_knowledge_company ON knowledge_base(company_id)');
      await client.query('CREATE INDEX idx_knowledge_category ON knowledge_base(category)');
      await client.query('CREATE INDEX idx_knowledge_is_active ON knowledge_base(is_active)');
      console.log('✅ Đã tạo các indexes cho bảng knowledge_base');
      
      // Thêm dữ liệu mẫu
      await client.query(`
        INSERT INTO knowledge_base (
          company_id, question, answer, keywords, category, is_active
        ) VALUES (
          (SELECT id FROM companies WHERE company_code = 'PDH'),
          'Ban pháp chế có những chức năng gì?',
          'Ban pháp chế có các chức năng chính: (1) Tư vấn pháp lý nội bộ, (2) Soạn thảo và rà soát hợp đồng, (3) Quản lý rủi ro pháp lý, (4) Đại diện công ty trong các vấn đề pháp lý, (5) Theo dõi tuân thủ quy định pháp luật.',
          ARRAY['ban pháp chế', 'chức năng', 'nhiệm vụ', 'tư vấn pháp lý', 'hợp đồng', 'rủi ro pháp lý'],
          'Legal',
          true
        )
      `);
      
      await client.query(`
        INSERT INTO knowledge_base (
          company_id, question, answer, keywords, category, is_active
        ) VALUES (
          (SELECT id FROM companies WHERE company_code = 'PDH'),
          'Ban pháp chế có bao nhiêu người?',
          'Ban pháp chế của PDH hiện có 5 người, bao gồm 1 trưởng ban, 2 chuyên viên pháp chế cao cấp và 2 chuyên viên pháp chế.',
          ARRAY['ban pháp chế', 'số lượng', 'nhân sự', 'PDH'],
          'Legal',
          true
        )
      `);
      
      await client.query(`
        INSERT INTO knowledge_base (
          company_id, question, answer, keywords, category, is_active
        ) VALUES (
          (SELECT id FROM companies WHERE company_code = 'PDH'),
          'Ai là trưởng ban pháp chế?',
          'Trưởng ban pháp chế hiện tại của PDH là ông Nguyễn Văn Pháp, ông đã giữ vị trí này từ tháng 6/2023.',
          ARRAY['trưởng ban pháp chế', 'lãnh đạo', 'PDH', 'Nguyễn Văn Pháp'],
          'Legal',
          true
        )
      `);
      
      console.log('✅ Đã thêm dữ liệu mẫu cho knowledge_base');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Đã hoàn thành việc tạo bảng knowledge_base');
    
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi tạo bảng knowledge_base:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Thực thi hàm
createKnowledgeBaseTable()
  .then(() => {
    console.log('🎉 Quá trình tạo bảng knowledge_base hoàn tất thành công');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Quá trình tạo bảng knowledge_base thất bại:', error);
    process.exit(1);
  }); 