const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Initialize database schema
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Create companies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        parent_group VARCHAR(255),
        chairman VARCHAR(255),
        ceo VARCHAR(255),
        description TEXT,
        keywords TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        content_text TEXT,
        company_id INTEGER REFERENCES companies(id),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE,
        metadata JSONB
      )
    `);

    // Create questions table for Q&A history
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        document_ids INTEGER[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        response_time INTEGER
      )
    `);

    // Create document_chunks table for better search
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        chunk_text TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create sensitive_rules table for content filtering
    await client.query(`
      CREATE TABLE IF NOT EXISTS sensitive_rules (
        id SERIAL PRIMARY KEY,
        rule_name VARCHAR(255) NOT NULL,
        pattern TEXT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create knowledge_base table for additional company information
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        keywords TEXT[],
        category VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Database query functions
const db = {
  // Document operations
  async createDocument(documentData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO documents (filename, original_name, file_path, file_size, content_text, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [documentData.filename, documentData.originalName, documentData.filePath, documentData.fileSize, documentData.content, documentData.metadata]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  async getDocuments() {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM documents ORDER BY upload_date DESC');
      return result.rows;
    } finally {
      client.release();
    }
  },

  async getDocumentById(id) {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM documents WHERE id = $1', [id]);
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  async updateDocumentProcessed(id, processed = true) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE documents SET processed = $1 WHERE id = $2 RETURNING *',
        [processed, id]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  async searchDocuments(searchTerm) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM documents WHERE content_text ILIKE $1 OR original_name ILIKE $1 ORDER BY upload_date DESC',
        [`%${searchTerm}%`]
      );
      return result.rows;
    } finally {
      client.release();
    }
  },

  // Question operations
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
  },

  async getQuestions(limit = 50) {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM questions ORDER BY created_at DESC LIMIT $1', [limit]);
      return result.rows;
    } finally {
      client.release();
    }
  },

  // Document chunks operations
  async createDocumentChunk(documentId, chunkText, chunkIndex) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO document_chunks (document_id, chunk_text, chunk_index) VALUES ($1, $2, $3) RETURNING *',
        [documentId, chunkText, chunkIndex]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  async getDocumentChunks(documentId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index',
        [documentId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  },

  async deleteDocument(id) {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM documents WHERE id = $1', [id]);
      return true;
    } finally {
      client.release();
    }
  },

  // Company operations
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
  },

  async getCompanies() {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM companies ORDER BY code');
      return result.rows;
    } finally {
      client.release();
    }
  },

  async getCompanyByCode(code) {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM companies WHERE code = $1', [code]);
      return result.rows[0];
    } finally {
      client.release();
    }
  },

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
  },

  async deleteCompany(id) {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM companies WHERE id = $1', [id]);
      return true;
    } finally {
      client.release();
    }
  },

  // Sensitive rules operations
  async createSensitiveRule(ruleData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO sensitive_rules (rule_name, pattern, description, is_active) VALUES ($1, $2, $3, $4) RETURNING *',
        [ruleData.ruleName, ruleData.pattern, ruleData.description, ruleData.isActive]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  async getSensitiveRules(activeOnly = true) {
    const client = await pool.connect();
    try {
      const query = activeOnly 
        ? 'SELECT * FROM sensitive_rules WHERE is_active = true ORDER BY rule_name'
        : 'SELECT * FROM sensitive_rules ORDER BY rule_name';
      const result = await client.query(query);
      return result.rows;
    } finally {
      client.release();
    }
  },

  async updateSensitiveRule(id, ruleData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE sensitive_rules SET rule_name = $1, pattern = $2, description = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
        [ruleData.ruleName, ruleData.pattern, ruleData.description, ruleData.isActive, id]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  },

  async deleteSensitiveRule(id) {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM sensitive_rules WHERE id = $1', [id]);
      return true;
    } finally {
      client.release();
    }
  },

  // Knowledge base operations
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
  },

  async getKnowledgeByCompany(companyId, activeOnly = true) {
    const client = await pool.connect();
    try {
      const query = activeOnly 
        ? 'SELECT kb.*, c.code as company_code, c.full_name as company_name FROM knowledge_base kb JOIN companies c ON kb.company_id = c.id WHERE kb.company_id = $1 AND kb.is_active = true ORDER BY kb.created_at DESC'
        : 'SELECT kb.*, c.code as company_code, c.full_name as company_name FROM knowledge_base kb JOIN companies c ON kb.company_id = c.id WHERE kb.company_id = $1 ORDER BY kb.created_at DESC';
      const result = await client.query(query, [companyId]);
      return result.rows;
    } finally {
      client.release();
    }
  },

  async searchKnowledge(searchTerm, companyId = null) {
    const client = await pool.connect();
    try {
      let query, params;
      if (companyId) {
        query = 'SELECT kb.*, c.code as company_code, c.full_name as company_name FROM knowledge_base kb JOIN companies c ON kb.company_id = c.id WHERE (kb.question ILIKE $1 OR kb.answer ILIKE $1 OR $1 = ANY(kb.keywords)) AND kb.company_id = $2 AND kb.is_active = true ORDER BY kb.created_at DESC';
        params = [`%${searchTerm}%`, companyId];
      } else {
        query = 'SELECT kb.*, c.code as company_code, c.full_name as company_name FROM knowledge_base kb JOIN companies c ON kb.company_id = c.id WHERE (kb.question ILIKE $1 OR kb.answer ILIKE $1 OR $1 = ANY(kb.keywords)) AND kb.is_active = true ORDER BY kb.created_at DESC';
        params = [`%${searchTerm}%`];
      }
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  },

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
  },

  async deleteKnowledge(id) {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM knowledge_base WHERE id = $1', [id]);
      return true;
    } finally {
      client.release();
    }
  }
};

module.exports = {
  pool,
  initializeDatabase,
  db
}; 