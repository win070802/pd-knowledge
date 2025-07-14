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
    const { code, fullName, parentGroup, chairman, ceo, description, keywords } = req.body;
    
    if (!code || !fullName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Code and full name are required' 
      });
    }

    const company = await db.createCompany({
      code: code.toUpperCase(),
      fullName,
      parentGroup,
      chairman,
      ceo,
      description,
      keywords
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Company created successfully',
      data: company
    });
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