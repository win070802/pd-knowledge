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
    // Create documents table
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        content_text TEXT,
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
  }
};

module.exports = {
  pool,
  initializeDatabase,
  db
}; 