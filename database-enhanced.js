const { Pool } = require('pg');
const { pool } = require('./database');
require('dotenv').config();

// Enhanced database schema with full-text search
async function enhanceDatabase() {
  const client = await pool.connect();
  
  try {
    // Add full-text search column to documents
    await client.query(`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS search_vector tsvector;
    `);

    // Create full-text search index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_search 
      ON documents USING gin(search_vector);
    `);

    // Create function to update search vector
    await client.query(`
      CREATE OR REPLACE FUNCTION update_document_search_vector() 
      RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := 
          setweight(to_tsvector('english', COALESCE(NEW.original_name, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(NEW.content_text, '')), 'B');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger for auto-update search vector
    await client.query(`
      DROP TRIGGER IF EXISTS documents_search_vector_update ON documents;
      CREATE TRIGGER documents_search_vector_update
        BEFORE INSERT OR UPDATE ON documents
        FOR EACH ROW EXECUTE FUNCTION update_document_search_vector();
    `);

    // Enhanced document_chunks for semantic search
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_embeddings (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        chunk_id INTEGER REFERENCES document_chunks(id) ON DELETE CASCADE,
        embedding vector(1536), -- OpenAI embeddings dimension
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Document analytics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_analytics (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        view_count INTEGER DEFAULT 0,
        search_count INTEGER DEFAULT 0,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        popular_keywords TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Content extraction metadata
    await client.query(`
      CREATE TABLE IF NOT EXISTS content_metadata (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        page_count INTEGER,
        word_count INTEGER,
        character_count INTEGER,
        language VARCHAR(10),
        confidence_score FLOAT,
        extraction_method VARCHAR(50), -- 'pdf-parse', 'ocr', 'hybrid'
        extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Enhanced database schema applied');
  } catch (error) {
    console.error('❌ Error enhancing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Enhanced search functions
const enhancedDb = {
  // Full-text search với ranking
  async searchDocumentsFullText(query, companyId = null, limit = 10) {
    const client = await pool.connect();
    try {
      let sql = `
        SELECT d.*, 
               ts_rank_cd(search_vector, plainto_tsquery('english', $1)) as rank,
               ts_headline('english', content_text, plainto_tsquery('english', $1)) as highlight
        FROM documents d 
        WHERE search_vector @@ plainto_tsquery('english', $1)
      `;
      let params = [query];
      
      if (companyId) {
        sql += ` AND company_id = $2`;
        params.push(companyId);
      }
      
      sql += ` ORDER BY rank DESC, upload_date DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  },

  // Search với filters nâng cao
  async searchWithFilters(filters) {
    const client = await pool.connect();
    try {
      let sql = `
        SELECT d.*, c.code as company_code, c.full_name as company_name,
               cm.word_count, cm.page_count, cm.language
        FROM documents d
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN content_metadata cm ON d.id = cm.document_id
        WHERE 1=1
      `;
      let params = [];
      let paramIndex = 1;

      // Text search
      if (filters.query) {
        sql += ` AND search_vector @@ plainto_tsquery('english', $${paramIndex})`;
        params.push(filters.query);
        paramIndex++;
      }

      // Company filter
      if (filters.companyId) {
        sql += ` AND d.company_id = $${paramIndex}`;
        params.push(filters.companyId);
        paramIndex++;
      }

      // Date range
      if (filters.dateFrom) {
        sql += ` AND d.upload_date >= $${paramIndex}`;
        params.push(filters.dateFrom);
        paramIndex++;
      }

      if (filters.dateTo) {
        sql += ` AND d.upload_date <= $${paramIndex}`;
        params.push(filters.dateTo);
        paramIndex++;
      }

      // File size range
      if (filters.minSize) {
        sql += ` AND d.file_size >= $${paramIndex}`;
        params.push(filters.minSize);
        paramIndex++;
      }

      if (filters.maxSize) {
        sql += ` AND d.file_size <= $${paramIndex}`;
        params.push(filters.maxSize);
        paramIndex++;
      }

      // Language filter
      if (filters.language) {
        sql += ` AND cm.language = $${paramIndex}`;
        params.push(filters.language);
        paramIndex++;
      }

      sql += ` ORDER BY d.upload_date DESC`;
      
      if (filters.limit) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
      }

      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  },

  // Update document analytics
  async updateDocumentAnalytics(documentId, action = 'view') {
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO document_analytics (document_id, view_count, search_count)
        VALUES ($1, $2, $3)
        ON CONFLICT (document_id) 
        DO UPDATE SET
          view_count = document_analytics.view_count + $2,
          search_count = document_analytics.search_count + $3,
          last_accessed = CURRENT_TIMESTAMP
      `, [documentId, action === 'view' ? 1 : 0, action === 'search' ? 1 : 0]);
    } finally {
      client.release();
    }
  },

  // Get document insights
  async getDocumentInsights(limit = 10) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT d.id, d.original_name, c.code as company_code,
               da.view_count, da.search_count, da.last_accessed,
               cm.word_count, cm.page_count
        FROM documents d
        LEFT JOIN document_analytics da ON d.id = da.document_id  
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN content_metadata cm ON d.id = cm.document_id
        ORDER BY da.view_count DESC, da.search_count DESC
        LIMIT $1
      `, [limit]);
      return result.rows;
    } finally {
      client.release();
    }
  },

  // Content metadata operations
  async saveContentMetadata(documentId, metadata) {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO content_metadata 
        (document_id, page_count, word_count, character_count, language, confidence_score, extraction_method)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        documentId, 
        metadata.pageCount,
        metadata.wordCount, 
        metadata.characterCount,
        metadata.language,
        metadata.confidenceScore,
        metadata.extractionMethod
      ]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }
};

module.exports = {
  enhanceDatabase,
  enhancedDb
}; 