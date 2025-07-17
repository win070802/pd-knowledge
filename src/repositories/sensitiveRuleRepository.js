const { pool } = require('../config/database');

class SensitiveRuleRepository {
  async createSensitiveRule(ruleData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO sensitive_rules (pattern, description, category, active) VALUES ($1, $2, $3, $4) RETURNING *',
        [ruleData.pattern, ruleData.description, ruleData.category || null, ruleData.isActive]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getSensitiveRules(activeOnly = true) {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM sensitive_rules';
      const params = [];
      
      if (activeOnly) {
        query += ' WHERE active = $1';
        params.push(true);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async updateSensitiveRule(id, ruleData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE sensitive_rules SET pattern = $1, description = $2, category = $3, active = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
        [ruleData.pattern, ruleData.description, ruleData.category || null, ruleData.isActive, id]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async deleteSensitiveRule(id) {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM sensitive_rules WHERE id = $1', [id]);
      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }
}

module.exports = new SensitiveRuleRepository(); 