const { pool } = require('../config/database');

class SensitiveRuleRepository {
  async createSensitiveRule(ruleData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO sensitive_rules (rule_name, pattern, description, category, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [ruleData.ruleName || ruleData.pattern, ruleData.pattern, ruleData.description, ruleData.category || null, ruleData.isActive]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getSensitiveRules(activeOnly = true) {
    const client = await pool.connect();
    try {
      let query = 'SELECT id, rule_name, pattern, description, category, is_active, created_at, updated_at FROM sensitive_rules';
      const params = [];
      
      if (activeOnly) {
        query += ' WHERE is_active = $1';
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
        'UPDATE sensitive_rules SET rule_name = $1, pattern = $2, description = $3, category = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
        [ruleData.ruleName || ruleData.pattern, ruleData.pattern, ruleData.description, ruleData.category || null, ruleData.isActive, id]
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