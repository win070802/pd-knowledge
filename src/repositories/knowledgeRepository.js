const { pool } = require('../config/database');

class KnowledgeRepository {
  async createKnowledge(knowledgeData) {
    const client = await pool.connect();
    try {
      // Thêm metadata vào câu query nếu có
      const hasMetadata = knowledgeData.metadata !== undefined;
      let query = 'INSERT INTO knowledge_base (company_id, question, answer, keywords, category, is_active';
      let valuePlaceholders = '($1, $2, $3, $4, $5, $6';
      const values = [
        knowledgeData.companyId, 
        knowledgeData.question, 
        knowledgeData.answer, 
        knowledgeData.keywords, 
        knowledgeData.category, 
        knowledgeData.isActive
      ];
      
      if (hasMetadata) {
        query += ', metadata';
        valuePlaceholders += ', $7';
        values.push(knowledgeData.metadata);
      }
      
      query += ') VALUES ' + valuePlaceholders + ') RETURNING *';
      
      const result = await client.query(query, values);
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
      // Xây dựng câu query động dựa trên các trường được cung cấp
      const setFields = [];
      const values = [];
      let paramIndex = 1;

      // Thêm các trường cơ bản nếu có
      if (knowledgeData.question !== undefined) {
        setFields.push(`question = $${paramIndex++}`);
        values.push(knowledgeData.question);
      }
      
      if (knowledgeData.answer !== undefined) {
        setFields.push(`answer = $${paramIndex++}`);
        values.push(knowledgeData.answer);
      }
      
      if (knowledgeData.keywords !== undefined) {
        setFields.push(`keywords = $${paramIndex++}`);
        values.push(knowledgeData.keywords);
      }
      
      if (knowledgeData.category !== undefined) {
        setFields.push(`category = $${paramIndex++}`);
        values.push(knowledgeData.category);
      }
      
      if (knowledgeData.isActive !== undefined) {
        setFields.push(`is_active = $${paramIndex++}`);
        values.push(knowledgeData.isActive);
      }
      
      if (knowledgeData.companyId !== undefined) {
        setFields.push(`company_id = $${paramIndex++}`);
        values.push(knowledgeData.companyId);
      }
      
      // Thêm trường metadata nếu có
      if (knowledgeData.metadata !== undefined) {
        setFields.push(`metadata = $${paramIndex++}`);
        values.push(knowledgeData.metadata);
      }
      
      // Thêm updated_at timestamp
      setFields.push(`updated_at = CURRENT_TIMESTAMP`);
      
      if (setFields.length === 0) {
        throw new Error('No fields to update');
      }
      
      // Thêm ID vào cuối values array
      values.push(id);
      
      const query = `UPDATE knowledge_base SET ${setFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const result = await client.query(query, values);
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