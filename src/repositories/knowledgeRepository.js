const { pool } = require('../config/database');

class KnowledgeRepository {
  async createKnowledge(knowledgeData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO knowledge_base (company_id, question, answer, keywords, category, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [knowledgeData.companyId, knowledgeData.question, knowledgeData.answer, knowledgeData.keywords, knowledgeData.category, knowledgeData.isActive]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getKnowledgeByCompany(companyId, activeOnly = true) {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM knowledge_base WHERE company_id = $1';
      const params = [companyId];
      
      if (activeOnly) {
        query += ' AND is_active = $2';
        params.push(true);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async searchKnowledge(searchTerm, companyId = null) {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM knowledge_base WHERE (question ILIKE $1 OR answer ILIKE $1)';
      const params = [`%${searchTerm}%`];
      
      if (companyId) {
        query += ' AND company_id = $2';
        params.push(companyId);
      }
      
      query += ' AND is_active = true ORDER BY created_at DESC';
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async updateKnowledge(id, knowledgeData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE knowledge_base SET question = $1, answer = $2, keywords = $3, category = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
        [knowledgeData.question, knowledgeData.answer, knowledgeData.keywords, knowledgeData.category, knowledgeData.isActive, id]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async deleteKnowledge(id) {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM knowledge_base WHERE id = $1', [id]);
      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }
}

module.exports = new KnowledgeRepository(); 