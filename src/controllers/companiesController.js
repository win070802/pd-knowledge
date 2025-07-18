const { db } = require('../../database');

// Get all companies
const getCompanies = async (req, res) => {
  try {
    const companies = await db.getCompanies();
    res.json({ success: true, data: companies });
  } catch (error) {
    console.error('Error getting companies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get company by code
const getCompanyByCode = async (req, res) => {
  try {
    const company = await db.getCompanyByCode(req.params.code.toUpperCase());
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }
    res.json({ success: true, data: company });
  } catch (error) {
    console.error('Error getting company:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create company
const createCompany = async (req, res) => {
  try {
    const { 
      company_code, 
      company_name, 
      company_name_en, 
      short_name,
      legal_form,
      tax_code,
      business_license,
      headquarters_address,
      city,
      province,
      phone,
      email,
      website,
      industry,
      business_type,
      registered_capital,
      charter_capital,
      currency_code,
      legal_representative,
      ceo,
      chairman,
      status,
      established_date,
      description,
      departments,
      business_functions,
      document_categories
    } = req.body;
    
    if (!company_code || !company_name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Company code and name are required' 
      });
    }

    // Sử dụng pool trực tiếp
    const { pool } = require('../config/database');
    const client = await pool.connect();
    
    try {
      // Kiểm tra xem company code đã tồn tại chưa
      const checkResult = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM companies 
          WHERE company_code = $1
        )
      `, [company_code.toUpperCase()]);
      
      if (checkResult.rows[0].exists) {
        return res.status(400).json({ 
          success: false, 
          error: 'Company code already exists' 
        });
      }
      
      // Bắt đầu transaction
      await client.query('BEGIN');
      
      // Thêm công ty mới
      const result = await client.query(`
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
          departments, business_functions, document_categories
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28
        ) RETURNING *
      `, [
        company_code.toUpperCase(),
        company_name,
        company_name_en || null,
        short_name || null,
        legal_form || null,
        tax_code || null,
        business_license || null,
        headquarters_address || null,
        city || null,
        province || null,
        phone || null,
        email || null,
        website || null,
        industry || null,
        business_type || null,
        registered_capital || null,
        charter_capital || null,
        currency_code || 'VND',
        legal_representative || null,
        ceo || null,
        chairman || null,
        status || 'active',
        established_date ? new Date(established_date) : null,
        req.user ? req.user.username : 'system',
        description || null,
        departments ? JSON.stringify(departments) : null,
        business_functions ? JSON.stringify(business_functions) : null,
        document_categories ? JSON.stringify(document_categories) : null
      ]);
      
      const company = result.rows[0];
      
      // Tự động tạo các knowledge entries cơ bản cho công ty mới
      const basicKnowledgeEntries = [
        {
          question: `${company_code} là gì?`,
          answer: `${company_name} (mã ${company_code}) ${description ? 'là ' + description : ''}.`,
          category: 'company_info'
        },
        {
          question: `${company_name} là công ty gì?`,
          answer: `${company_name} (mã ${company_code}) ${description ? 'là ' + description : ''}.`,
          category: 'company_info'
        }
      ];
      
      // Thêm thông tin về người đại diện pháp luật nếu có
      if (legal_representative) {
        basicKnowledgeEntries.push({
          question: `Ai là người đại diện pháp luật của ${company_code}?`,
          answer: `Người đại diện pháp luật của ${company_name} (${company_code}) là ${legal_representative}.`,
          category: 'leadership'
        });
      }
      
      // Thêm thông tin về CEO nếu có
      if (ceo) {
        basicKnowledgeEntries.push({
          question: `Ai là CEO/Tổng giám đốc của ${company_code}?`,
          answer: `CEO/Tổng giám đốc của ${company_name} (${company_code}) là ${ceo}.`,
          category: 'leadership'
        });
      }
      
      // Thêm thông tin về Chủ tịch nếu có
      if (chairman) {
        basicKnowledgeEntries.push({
          question: `Ai là Chủ tịch của ${company_code}?`,
          answer: `Chủ tịch của ${company_name} (${company_code}) là ${chairman}.`,
          category: 'leadership'
        });
      }
      
      // Thêm thông tin về địa chỉ nếu có
      if (headquarters_address) {
        basicKnowledgeEntries.push({
          question: `Địa chỉ của ${company_code} ở đâu?`,
          answer: `Trụ sở chính của ${company_name} (${company_code}) đặt tại ${headquarters_address}${city ? ', ' + city : ''}${province ? ', ' + province : ''}.`,
          category: 'contact'
        });
      }
      
      // Thêm thông tin về liên hệ nếu có
      if (phone || email || website) {
        let contactInfo = `Thông tin liên hệ của ${company_name} (${company_code}): `;
        if (phone) contactInfo += `\nSố điện thoại: ${phone}`;
        if (email) contactInfo += `\nEmail: ${email}`;
        if (website) contactInfo += `\nWebsite: ${website}`;
        
        basicKnowledgeEntries.push({
          question: `Thông tin liên hệ của ${company_code}?`,
          answer: contactInfo,
          category: 'contact'
        });
      }
      
      // Thêm thông tin về ngành nghề nếu có
      if (industry || business_type) {
        let businessInfo = `${company_name} (${company_code}) hoạt động trong lĩnh vực `;
        if (industry) businessInfo += industry;
        if (business_type) businessInfo += industry ? ` với loại hình kinh doanh là ${business_type}` : business_type;
        businessInfo += '.';
        
        basicKnowledgeEntries.push({
          question: `${company_code} hoạt động trong lĩnh vực gì?`,
          answer: businessInfo,
          category: 'business'
        });
      }
      
      // Thêm thông tin về vốn nếu có
      if (registered_capital || charter_capital) {
        let capitalInfo = `Thông tin vốn của ${company_name} (${company_code}): `;
        if (registered_capital) capitalInfo += `\nVốn đăng ký: ${registered_capital} ${currency_code || 'VND'}`;
        if (charter_capital) capitalInfo += `\nVốn điều lệ: ${charter_capital} ${currency_code || 'VND'}`;
        
        basicKnowledgeEntries.push({
          question: `Thông tin vốn của ${company_code}?`,
          answer: capitalInfo,
          category: 'financial'
        });
      }
      
      // Lưu các knowledge entries vào database
      for (const entry of basicKnowledgeEntries) {
        await client.query(`
          INSERT INTO knowledge_base (
            question, 
            answer, 
            company_id,
            category,
            is_active,
            metadata
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          entry.question,
          entry.answer,
          company.id,
          entry.category,
          true,
          JSON.stringify({
            source: 'auto_generated',
            created_from: 'company_creation',
            timestamp: new Date().toISOString()
          })
        ]);
      }
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log(`✅ Created company: ${company.company_code} - ${company.company_name} with ${basicKnowledgeEntries.length} knowledge entries`);
    
    res.status(201).json({ 
      success: true, 
      message: 'Company created successfully',
      data: company
    });
    } catch (error) {
      // Rollback transaction nếu có lỗi
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating company:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ success: false, error: 'Company code already exists' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

// Update company
const updateCompany = async (req, res) => {
  try {
    const { fullName, parentGroup, chairman, ceo, description, keywords } = req.body;
    
    const company = await db.updateCompany(req.params.id, {
      fullName,
      parentGroup,
      chairman,
      ceo,
      description,
      keywords
    });
    
    if (!company) {
      return res.status(404).json({ success: false, error: 'Company not found' });
    }
    
    res.json({ 
      success: true, 
      message: 'Company updated successfully',
      data: company
    });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete company
const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Sử dụng pool trực tiếp
    const { pool } = require('../config/database');
    const client = await pool.connect();
    
    try {
      // Bắt đầu transaction
      await client.query('BEGIN');
      
      // Kiểm tra công ty tồn tại không
      const companyResult = await client.query('SELECT * FROM companies WHERE id = $1', [id]);
      if (companyResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Company not found' 
        });
      }
      
      const company = companyResult.rows[0];
      
      // Xóa tất cả knowledge liên quan đến công ty
      const knowledgeResult = await client.query('DELETE FROM knowledge_base WHERE company_id = $1 RETURNING id', [id]);
      const deletedKnowledgeCount = knowledgeResult.rows.length;
      
      // Xóa công ty
      await client.query('DELETE FROM companies WHERE id = $1', [id]);
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log(`✅ Deleted company: ${company.company_code} - ${company.company_name} and ${deletedKnowledgeCount} related knowledge entries`);
      
      res.json({ 
        success: true, 
        message: `Company deleted successfully along with ${deletedKnowledgeCount} knowledge entries`
      });
    } catch (error) {
      // Rollback transaction nếu có lỗi
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getCompanies,
  getCompanyByCode,
  createCompany,
  updateCompany,
  deleteCompany
}; 