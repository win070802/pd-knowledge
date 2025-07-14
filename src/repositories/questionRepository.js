const { pool } = require('../config/database');

class QuestionRepository {
  async createQuestion(questionData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO questions (question, answer, document_ids, response_time) VALUES ($1, $2, $3, $4) RETURNING *',
        [questionData.question, questionData.answer, questionData.documentIds, questionData.responseTime]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getQuestions(limit = 50) {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM questions ORDER BY created_at DESC LIMIT $1', [limit]);
      return result.rows;
    } finally {
      client.release();
    }
  }
}

module.exports = new QuestionRepository(); 