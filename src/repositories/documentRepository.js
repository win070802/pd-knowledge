const { pool } = require('../config/database');

class DocumentRepository {
  async createDocument(documentData) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO documents (filename, original_name, file_path, file_size, content_text, company_id, category, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [documentData.filename, documentData.originalName, documentData.filePath, documentData.fileSize, documentData.content, documentData.companyId, documentData.category, documentData.metadata]
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

  async getDocumentsByCompany(companyCode) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT d.*, c.code as company_code, c.full_name as company_name 
        FROM documents d 
        JOIN companies c ON d.company_id = c.id 
        WHERE c.code = $1 
        ORDER BY d.upload_date DESC
      `, [companyCode]);
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
      // Extract keywords from search term
      const keywords = searchTerm.toLowerCase()
        .replace(/[^\w\sàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 10); // Limit to 10 keywords

      console.log(`📄 Searching with keywords:`, keywords);

      if (keywords.length === 0) {
        // Fallback to simple search
      const result = await client.query(
        'SELECT * FROM documents WHERE content_text ILIKE $1 ORDER BY upload_date DESC',
        [`%${searchTerm}%`]
      );
        return result.rows;
      }

      // Build flexible search query
      let query = `
        SELECT *, 
        (
          CASE 
            WHEN original_name ILIKE $1 THEN 100
            ELSE 0
          END +
          CASE 
            WHEN category ILIKE $1 THEN 80
            ELSE 0
          END
      `;
      
      const params = [`%${searchTerm}%`];
      
      // Add keyword scoring
      for (let i = 0; i < keywords.length; i++) {
        const paramIndex = params.length + 1;
        query += ` + CASE WHEN content_text ILIKE $${paramIndex} THEN 10 ELSE 0 END`;
        query += ` + CASE WHEN original_name ILIKE $${paramIndex} THEN 20 ELSE 0 END`;
        params.push(`%${keywords[i]}%`);
      }
      
      query += `
        ) as relevance_score
        FROM documents 
        WHERE (
          content_text ILIKE $1 
          OR original_name ILIKE $1 
          OR category ILIKE $1
      `;
      
      // Add OR conditions for keywords
      for (let i = 0; i < keywords.length; i++) {
        const paramIndex = 2 + i; // Start from param $2
        query += ` OR content_text ILIKE $${paramIndex} OR original_name ILIKE $${paramIndex}`;
      }
      
      query += `
        )
        ORDER BY relevance_score DESC, upload_date DESC
        LIMIT 20
      `;

      console.log(`📄 Executing search query with ${params.length} parameters`);
      const result = await client.query(query, params);
      
      console.log(`📄 Found ${result.rows.length} documents with relevance scores`);
      result.rows.forEach(doc => {
        console.log(`📄 ${doc.original_name} (score: ${doc.relevance_score})`);
      });
      
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