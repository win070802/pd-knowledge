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
      
      // Commit transaction
      await client.query('COMMIT');
      
      const company = result.rows[0];
      console.log(`✅ Created company: ${company.company_code} - ${company.company_name}`);
    
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
    const success = await db.deleteCompany(req.params.id);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Company deleted successfully'
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Company not found' 
      });
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