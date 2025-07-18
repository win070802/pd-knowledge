const { pool } = require('../src/config/database');

/**
 * Thêm dữ liệu công ty mới vào cơ sở dữ liệu
 */
async function addCompanyData() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Bắt đầu thêm dữ liệu công ty mới...');
    
    // Bắt đầu transaction
    await client.query('BEGIN');
    
    // Thêm công ty PDI - Phát Đạt Investment
    const pdiExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM companies 
        WHERE company_code = 'PDI'
      );
    `);
    
    if (pdiExists.rows[0].exists) {
      console.log('ℹ️ Công ty PDI đã tồn tại, bỏ qua bước thêm công ty này');
    } else {
      await client.query(`
        INSERT INTO companies (
            company_code, company_name, company_name_en, short_name,
            legal_form, tax_code, business_license,
            headquarters_address, city, province,
            phone, email, website,
            industry, business_type,
            registered_capital, charter_capital, currency_code,
            legal_representative, ceo, chairman,
            status, established_date,
            created_by, description,
            document_naming_convention, default_retention_policy,
            document_approval_workflow, security_policies,
            compliance_requirements, departments, business_functions,
            document_categories, workflow_templates,
            supported_languages, company_branding
        ) VALUES 
        (
            'PDI', 'Công ty Cổ phần Đầu tư Phát Đạt', 'Phat Dat Investment', 'Phát Đạt Investment',
            'Công ty Cổ phần', '0987654321', 'ĐKKD002',
            '456 Nguyễn Công Trứ, Quận 1, TP.HCM', 'Hồ Chí Minh', 'Hồ Chí Minh',
            '028-98765432', 'info@phatdatinvestment.com', 'https://phatdatinvestment.com',
            'Đầu tư bất động sản', 'Subsidiary',
            300000000000, 300000000000, 'VND',
            'Trần Văn C', 'Trần Văn C', 'Nguyễn Văn A',
            'active', '2015-05-20',
            'system', 'Công ty con của Phát Đạt Holdings, chuyên về đầu tư và phát triển dự án bất động sản cao cấp',
            
            'PDI-{TYPE}-{YEAR}-{SEQUENCE}',
            
            '{"contracts": {"period": 5, "trigger": "expiry", "action": "review"}, "policies": {"period": 3, "trigger": "update", "action": "review"}}',
            
            '{"draft": {"next": "review", "approvers": ["creator", "supervisor"]}, "review": {"next": "approved", "approvers": ["department_head", "legal"]}}',
            
            '{"classification_levels": ["public", "internal", "confidential", "secret"], "default_classification": "internal"}',
            
            ARRAY['Luật Đầu tư', 'Luật Kinh doanh Bất động sản', 'Thông tư 03/2021/TT-BXD'],
            
            '{"BDT": {"name": "Ban Đầu tư", "code": "BDT", "head": "Giám đốc Đầu tư"}}',
            
            '{"investment": {"name": "Đầu tư", "departments": ["BDT"]}}',
            
            '{"investment": {"name": "Đầu tư", "subcategories": ["proposals", "analysis", "approvals"]}}',
            
            '{"investment_approval": {"name": "Phê duyệt đầu tư", "steps": [{"step": "draft", "approver": "investment_officer", "duration": 3}]}}',
            
            ARRAY['vi', 'en'],
            
            '{"logo": "/assets/logos/pdi-logo.png", "colors": {"primary": "#2563EB"}}'
        )
      `);
      console.log('✅ Đã thêm công ty PDI');
    }
    
    // Thêm công ty PDE - Phát Đạt Engineering
    const pdeExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM companies 
        WHERE company_code = 'PDE'
      );
    `);
    
    if (pdeExists.rows[0].exists) {
      console.log('ℹ️ Công ty PDE đã tồn tại, bỏ qua bước thêm công ty này');
    } else {
      await client.query(`
        INSERT INTO companies (
            company_code, company_name, company_name_en, short_name,
            legal_form, tax_code, business_license,
            headquarters_address, city, province,
            phone, email, website,
            industry, business_type,
            registered_capital, charter_capital, currency_code,
            legal_representative, ceo, chairman,
            status, established_date,
            created_by, description,
            document_naming_convention, default_retention_policy,
            document_approval_workflow, security_policies,
            compliance_requirements, departments, business_functions,
            document_categories, workflow_templates,
            supported_languages, company_branding
        ) VALUES 
        (
            'PDE', 'Công ty TNHH Kỹ thuật Phát Đạt', 'Phat Dat Engineering', 'Phát Đạt Engineering',
            'Công ty TNHH', '0765432198', 'ĐKKD003',
            '789 Lê Thánh Tôn, Quận 1, TP.HCM', 'Hồ Chí Minh', 'Hồ Chí Minh',
            '028-76543210', 'info@phatdatengineering.com', 'https://phatdatengineering.com',
            'Kỹ thuật và xây dựng', 'Subsidiary',
            200000000000, 200000000000, 'VND',
            'Lê Thị D', 'Lê Thị D', 'Nguyễn Văn A',
            'active', '2017-08-10',
            'system', 'Công ty con của Phát Đạt Holdings, chuyên về thiết kế, thi công và giám sát các công trình xây dựng',
            
            'PDE-{TYPE}-{YEAR}-{SEQUENCE}',
            
            '{"contracts": {"period": 5, "trigger": "expiry", "action": "review"}, "technical_documents": {"period": 10, "trigger": "project_completion", "action": "archive"}}',
            
            '{"draft": {"next": "review", "approvers": ["creator", "supervisor"]}, "review": {"next": "approved", "approvers": ["technical_lead", "project_manager"]}}',
            
            '{"classification_levels": ["public", "internal", "confidential", "secret"], "default_classification": "internal"}',
            
            ARRAY['Luật Xây dựng', 'Nghị định 15/2021/NĐ-CP', 'TCVN 4453:1995'],
            
            '{"BKT": {"name": "Ban Kỹ thuật", "code": "BKT", "head": "Giám đốc Kỹ thuật"}}',
            
            '{"engineering": {"name": "Kỹ thuật", "departments": ["BKT"]}}',
            
            '{"technical": {"name": "Kỹ thuật", "subcategories": ["designs", "specifications", "standards"]}}',
            
            '{"design_approval": {"name": "Phê duyệt thiết kế", "steps": [{"step": "draft", "approver": "design_engineer", "duration": 5}]}}',
            
            ARRAY['vi', 'en'],
            
            '{"logo": "/assets/logos/pde-logo.png", "colors": {"primary": "#10B981"}}'
        )
      `);
      console.log('✅ Đã thêm công ty PDE');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Đã hoàn thành việc thêm dữ liệu công ty mới');
    
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi thêm dữ liệu công ty mới:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Thực thi hàm
addCompanyData()
  .then(() => {
    console.log('🎉 Quá trình thêm dữ liệu công ty mới hoàn tất thành công');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Quá trình thêm dữ liệu công ty mới thất bại:', error);
    process.exit(1);
  }); 