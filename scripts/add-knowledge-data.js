const { pool } = require('../src/config/database');

/**
 * Thêm dữ liệu kiến thức mới vào cơ sở dữ liệu
 */
async function addKnowledgeData() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Bắt đầu thêm dữ liệu kiến thức mới...');
    
    // Bắt đầu transaction
    await client.query('BEGIN');
    
    // Lấy ID của các công ty
    const companiesResult = await client.query(`
      SELECT id, company_code 
      FROM companies
    `);
    
    const companies = {};
    companiesResult.rows.forEach(company => {
      companies[company.company_code] = company.id;
    });
    
    console.log('📊 Đã tìm thấy các công ty:', Object.keys(companies).join(', '));
    
    // Thêm kiến thức về PDI
    if (companies['PDI']) {
      // Kiểm tra xem đã có kiến thức về PDI chưa
      const pdiKnowledgeExists = await client.query(`
        SELECT COUNT(*) 
        FROM knowledge_base 
        WHERE company_id = $1 
        AND question LIKE '%PDI là gì%'
      `, [companies['PDI']]);
      
      if (parseInt(pdiKnowledgeExists.rows[0].count) > 0) {
        console.log('ℹ️ Đã có kiến thức về PDI, bỏ qua bước thêm kiến thức này');
      } else {
        // Thêm kiến thức cơ bản về PDI
        await client.query(`
          INSERT INTO knowledge_base (
            company_id, question, answer, keywords, category, is_active, metadata
          ) VALUES (
            $1,
            'Công ty PDI là gì?',
            'PDI (Phát Đạt Investment) là Công ty Cổ phần Đầu tư Phát Đạt, một công ty con của Phát Đạt Holdings. PDI chuyên về đầu tư và phát triển các dự án bất động sản cao cấp. Công ty được thành lập vào ngày 20/05/2015, có trụ sở chính tại 456 Nguyễn Công Trứ, Quận 1, TP.HCM.',
            ARRAY['PDI', 'Phát Đạt Investment', 'công ty con', 'bất động sản', 'đầu tư'],
            'Company',
            true,
            '{"companyInfo": true, "lastUpdated": "2025-07-18"}'
          )
        `, [companies['PDI']]);
        
        // Thêm kiến thức về lĩnh vực hoạt động của PDI
        await client.query(`
          INSERT INTO knowledge_base (
            company_id, question, answer, keywords, category, is_active
          ) VALUES (
            $1,
            'PDI hoạt động trong lĩnh vực nào?',
            'PDI (Phát Đạt Investment) hoạt động chủ yếu trong lĩnh vực đầu tư và phát triển bất động sản cao cấp. Các hoạt động chính của công ty bao gồm: phát triển dự án bất động sản, đầu tư vào các dự án tiềm năng, quản lý và khai thác các bất động sản thương mại, và tư vấn đầu tư bất động sản.',
            ARRAY['PDI', 'lĩnh vực', 'bất động sản', 'đầu tư', 'phát triển dự án'],
            'Business',
            true
          )
        `, [companies['PDI']]);
        
        // Thêm kiến thức về ban lãnh đạo PDI
        await client.query(`
          INSERT INTO knowledge_base (
            company_id, question, answer, keywords, category, is_active
          ) VALUES (
            $1,
            'Ai là CEO của PDI?',
            'CEO hiện tại của PDI (Phát Đạt Investment) là ông Trần Văn C. Ông cũng đồng thời là đại diện pháp luật của công ty. Ông Trần Văn C có hơn 15 năm kinh nghiệm trong lĩnh vực bất động sản và đầu tư tài chính.',
            ARRAY['PDI', 'CEO', 'lãnh đạo', 'Trần Văn C', 'đại diện pháp luật'],
            'Leadership',
            true
          )
        `, [companies['PDI']]);
        
        console.log('✅ Đã thêm kiến thức về PDI');
      }
    }
    
    // Thêm kiến thức về PDE
    if (companies['PDE']) {
      // Kiểm tra xem đã có kiến thức về PDE chưa
      const pdeKnowledgeExists = await client.query(`
        SELECT COUNT(*) 
        FROM knowledge_base 
        WHERE company_id = $1 
        AND question LIKE '%PDE là gì%'
      `, [companies['PDE']]);
      
      if (parseInt(pdeKnowledgeExists.rows[0].count) > 0) {
        console.log('ℹ️ Đã có kiến thức về PDE, bỏ qua bước thêm kiến thức này');
      } else {
        // Thêm kiến thức cơ bản về PDE
        await client.query(`
          INSERT INTO knowledge_base (
            company_id, question, answer, keywords, category, is_active, metadata
          ) VALUES (
            $1,
            'Công ty PDE là gì?',
            'PDE (Phát Đạt Engineering) là Công ty TNHH Kỹ thuật Phát Đạt, một công ty con của Phát Đạt Holdings. PDE chuyên về thiết kế, thi công và giám sát các công trình xây dựng. Công ty được thành lập vào ngày 10/08/2017, có trụ sở chính tại 789 Lê Thánh Tôn, Quận 1, TP.HCM.',
            ARRAY['PDE', 'Phát Đạt Engineering', 'công ty con', 'kỹ thuật', 'xây dựng'],
            'Company',
            true,
            '{"companyInfo": true, "lastUpdated": "2025-07-18"}'
          )
        `, [companies['PDE']]);
        
        // Thêm kiến thức về lĩnh vực hoạt động của PDE
        await client.query(`
          INSERT INTO knowledge_base (
            company_id, question, answer, keywords, category, is_active
          ) VALUES (
            $1,
            'PDE hoạt động trong lĩnh vực nào?',
            'PDE (Phát Đạt Engineering) hoạt động chủ yếu trong lĩnh vực kỹ thuật và xây dựng. Các hoạt động chính của công ty bao gồm: thiết kế kỹ thuật cho các dự án xây dựng, thi công và giám sát công trình, tư vấn kỹ thuật xây dựng, và quản lý dự án xây dựng.',
            ARRAY['PDE', 'lĩnh vực', 'kỹ thuật', 'xây dựng', 'thiết kế', 'thi công'],
            'Business',
            true
          )
        `, [companies['PDE']]);
        
        // Thêm kiến thức về ban lãnh đạo PDE
        await client.query(`
          INSERT INTO knowledge_base (
            company_id, question, answer, keywords, category, is_active
          ) VALUES (
            $1,
            'Ai là CEO của PDE?',
            'CEO hiện tại của PDE (Phát Đạt Engineering) là bà Lê Thị D. Bà cũng đồng thời là đại diện pháp luật của công ty. Bà Lê Thị D có hơn 12 năm kinh nghiệm trong lĩnh vực kỹ thuật xây dựng và quản lý dự án.',
            ARRAY['PDE', 'CEO', 'lãnh đạo', 'Lê Thị D', 'đại diện pháp luật'],
            'Leadership',
            true
          )
        `, [companies['PDE']]);
        
        console.log('✅ Đã thêm kiến thức về PDE');
      }
    }
    
    // Thêm kiến thức về mối quan hệ giữa các công ty
    if (companies['PDH'] && companies['PDI'] && companies['PDE']) {
      // Kiểm tra xem đã có kiến thức về mối quan hệ giữa các công ty chưa
      const relationshipKnowledgeExists = await client.query(`
        SELECT COUNT(*) 
        FROM knowledge_base 
        WHERE company_id = $1 
        AND question LIKE '%mối quan hệ%'
      `, [companies['PDH']]);
      
      if (parseInt(relationshipKnowledgeExists.rows[0].count) > 0) {
        console.log('ℹ️ Đã có kiến thức về mối quan hệ giữa các công ty, bỏ qua bước thêm kiến thức này');
      } else {
        // Thêm kiến thức về mối quan hệ giữa các công ty
        await client.query(`
          INSERT INTO knowledge_base (
            company_id, question, answer, keywords, category, is_active
          ) VALUES (
            $1,
            'Mối quan hệ giữa PDH, PDI và PDE là gì?',
            'PDH (Phát Đạt Holdings) là công ty mẹ trong hệ thống Phát Đạt. PDI (Phát Đạt Investment) và PDE (Phát Đạt Engineering) là các công ty con của PDH. PDI chuyên về đầu tư và phát triển bất động sản cao cấp, trong khi PDE chuyên về thiết kế, thi công và giám sát các công trình xây dựng. Cả ba công ty đều có trụ sở chính tại TP.HCM và hoạt động trong các lĩnh vực bổ trợ cho nhau.',
            ARRAY['PDH', 'PDI', 'PDE', 'mối quan hệ', 'công ty mẹ', 'công ty con'],
            'Corporate Structure',
            true
          )
        `, [companies['PDH']]);
        
        console.log('✅ Đã thêm kiến thức về mối quan hệ giữa các công ty');
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Đã hoàn thành việc thêm dữ liệu kiến thức mới');
    
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi thêm dữ liệu kiến thức mới:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Thực thi hàm
addKnowledgeData()
  .then(() => {
    console.log('🎉 Quá trình thêm dữ liệu kiến thức mới hoàn tất thành công');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Quá trình thêm dữ liệu kiến thức mới thất bại:', error);
    process.exit(1);
  }); 