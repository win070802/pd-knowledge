const { pool } = require('../config/database');

class DocumentRepository {
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
  }

  async getDocuments() {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM documents ORDER BY upload_date DESC');
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getDocumentById(id) {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM documents WHERE id = $1', [id]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

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
  }

  async updateDocument(id, updateData) {
    const client = await pool.connect();
    try {
      // Build dynamic update query
      const setFields = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          setFields.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (setFields.length === 0) {
        throw new Error('No fields to update');
      }

      const query = `UPDATE documents SET ${setFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      values.push(id);

      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async searchDocuments(searchTerm) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM documents WHERE content_text ILIKE $1 ORDER BY upload_date DESC',
        [`%${searchTerm}%`]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  async deleteDocument(id) {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM documents WHERE id = $1 RETURNING *', [id]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

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
  }

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
  }
}

module.exports = new DocumentRepository(); 