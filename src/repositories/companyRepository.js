const { pool } = require('../config/database');

class CompanyRepository {
  async createCompany(companyData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO companies (code, full_name, parent_group, chairman, ceo, description, keywords) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [companyData.code, companyData.fullName, companyData.parentGroup, companyData.chairman, companyData.ceo, companyData.description, companyData.keywords]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getCompanies() {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM companies ORDER BY created_at DESC');
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getCompanyByCode(code) {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM companies WHERE code = $1', [code]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async updateCompany(id, companyData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE companies SET full_name = $1, parent_group = $2, chairman = $3, ceo = $4, description = $5, keywords = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
        [companyData.fullName, companyData.parentGroup, companyData.chairman, companyData.ceo, companyData.description, companyData.keywords, id]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async deleteCompany(id) {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM companies WHERE id = $1', [id]);
      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }
}

module.exports = new CompanyRepository(); 