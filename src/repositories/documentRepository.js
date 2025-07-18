const { pool } = require('../config/database');

class DocumentRepository {
  async createDocument(documentData) {
    const client = await pool.connect();
    try {
      // Sử dụng bảng document_metadata thay vì documents
      const result = await client.query(
        `INSERT INTO document_metadata (
          dc_identifier, 
          dc_title, 
          dc_description, 
          dc_type, 
          dc_format, 
          dc_language,
          dc_date,
          record_identifier, 
          record_class, 
          company_id,
          file_size,
          primary_location,
          extracted_text,
          document_summary,
          key_information,
          keywords,
          categories,
          tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
        [
          `DOC-${Date.now()}`, // dc_identifier
          documentData.original_name, // dc_title
          documentData.metadata?.description || `Document ${documentData.original_name}`, // dc_description
          documentData.category || 'Document', // dc_type
          documentData.metadata?.format || 'application/pdf', // dc_format
          documentData.metadata?.language || 'vi', // dc_language
          new Date(), // dc_date
          `REC-${Date.now()}`, // record_identifier
          documentData.category || 'Document', // record_class
          documentData.company_id, // company_id
          documentData.file_size, // file_size
          documentData.file_path, // primary_location
          documentData.content_text, // extracted_text
          documentData.metadata?.summary || '', // document_summary
          documentData.metadata || {}, // key_information
          documentData.metadata?.keyTerms || [], // keywords
          [documentData.category], // categories
          documentData.metadata?.tags || [] // tags
        ]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getDocuments() {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM document_metadata ORDER BY date_created DESC');
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getDocumentsByCompany(companyCode) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT d.*, c.company_code as company_code, c.company_name as company_name 
        FROM document_metadata d 
        JOIN companies c ON d.company_id = c.id 
        WHERE c.company_code = $1 
        ORDER BY d.date_created DESC
      `, [companyCode]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async getDocumentById(id) {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM document_metadata WHERE id = $1', [id]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async updateDocumentProcessed(id, processed = true) {
    const client = await pool.connect();
    try {
      // Cập nhật trạng thái document_state thay vì processed
      const result = await client.query(
        'UPDATE document_metadata SET document_state = $1 WHERE id = $2 RETURNING *',
        [processed ? 'published' : 'draft', id]
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

      const query = `UPDATE document_metadata SET ${setFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      values.push(id);

      const result = await client.query(query, values);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Tìm kiếm tài liệu theo từ khóa
   * @param {string} query Từ khóa tìm kiếm
   * @param {number} limit Giới hạn kết quả trả về
   * @returns {Promise<Array>} Danh sách tài liệu tìm thấy
   */
  async searchDocuments(query, limit = 5) {
    const client = await pool.connect();
    try {
      // Chuẩn bị từ khóa tìm kiếm
      const searchPattern = `%${query.toLowerCase().replace(/\s+/g, '%')}%`;
      
      const result = await client.query(
        `SELECT * FROM document_metadata 
         WHERE LOWER(dc_title) LIKE $1 OR 
               LOWER(dc_description) LIKE $1 OR
               LOWER(document_summary) LIKE $1 OR
               extracted_text LIKE $1
         ORDER BY date_created DESC
         LIMIT $2`,
        [searchPattern, limit]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    } finally {
      client.release();
    }
  }

  async deleteDocument(id) {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM document_metadata WHERE id = $1 RETURNING *', [id]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  // Document chunks operations
  async createDocumentChunk(documentId, chunkText, chunkIndex) {
    const client = await pool.connect();
    try {
      // Kiểm tra xem document_chunks có tồn tại không
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'document_chunks'
        );
      `);
      
      if (!tableExists.rows[0].exists) {
        // Tạo bảng document_chunks nếu chưa tồn tại
        await client.query(`
          CREATE TABLE document_chunks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            document_id UUID REFERENCES document_metadata(id) ON DELETE CASCADE,
            chunk_text TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(document_id, chunk_index)
          )
        `);
        
        await client.query('CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id)');
      }
      
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

  /**
   * Tìm kiếm tài liệu theo tên chính xác
   * @param {string} name Tên tài liệu cần tìm
   * @returns {Promise<Array>} Danh sách tài liệu tìm thấy
   */
  async searchDocumentsByName(name) {
    const client = await pool.connect();
    try {
      // Xóa bỏ extension nếu cần để tìm kiếm chính xác hơn
      const baseName = name.replace(/\.(pdf|docx?|xlsx?|pptx?|txt)$/i, '');
      const searchName = `%${baseName}%`;
      
      const result = await client.query(
        `SELECT * FROM document_metadata 
         WHERE LOWER(dc_title) LIKE LOWER($1)
         ORDER BY 
           CASE 
             WHEN LOWER(dc_title) = LOWER($2) THEN 1
             ELSE 2
           END,
           date_created DESC
         LIMIT 5`,
        [searchName, name]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error searching documents by name:', error);
      return [];
    } finally {
      client.release();
    }
  }
}

module.exports = new DocumentRepository(); 