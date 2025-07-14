const { pool } = require('./database');

async function applyEnhancements() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Applying database enhancements...');

    // Add full-text search column to documents
    console.log('📝 Adding search_vector column...');
    await client.query(`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS search_vector tsvector;
    `);

    // Create full-text search index
    console.log('📇 Creating search index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_documents_search 
      ON documents USING gin(search_vector);
    `);

    // Create function to update search vector
    console.log('⚙️ Creating search vector function...');
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
    console.log('🔗 Creating trigger...');
    await client.query(`
      DROP TRIGGER IF EXISTS documents_search_vector_update ON documents;
      CREATE TRIGGER documents_search_vector_update
        BEFORE INSERT OR UPDATE ON documents
        FOR EACH ROW EXECUTE FUNCTION update_document_search_vector();
    `);

    // Update existing documents with search vectors
    console.log('🔄 Updating existing documents...');
    await client.query(`
      UPDATE documents 
      SET search_vector = 
        setweight(to_tsvector('english', COALESCE(original_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(content_text, '')), 'B')
      WHERE search_vector IS NULL;
    `);

    // Document analytics table
    console.log('📊 Creating analytics table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_analytics (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE UNIQUE,
        view_count INTEGER DEFAULT 0,
        search_count INTEGER DEFAULT 0,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        popular_keywords TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Content extraction metadata
    console.log('📋 Creating content metadata table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS content_metadata (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE UNIQUE,
        page_count INTEGER,
        word_count INTEGER,
        character_count INTEGER,
        language VARCHAR(10),
        confidence_score FLOAT,
        extraction_method VARCHAR(50), -- 'pdf-parse', 'ocr', 'hybrid'
        extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get current stats
    const docsResult = await client.query('SELECT COUNT(*) as count FROM documents');
    const documentsCount = docsResult.rows[0].count;

    const sizeResult = await client.query(`
      SELECT 
        pg_size_pretty(pg_total_relation_size('documents')) as table_size,
        pg_size_pretty(pg_database_size(current_database())) as db_size
    `);
    
    console.log('✅ Enhanced database schema applied successfully!');
    console.log('\n📊 Database Statistics:');
    console.log(`📄 Documents: ${documentsCount}`);
    console.log(`📦 Documents table size: ${sizeResult.rows[0].table_size}`);
    console.log(`💾 Total database size: ${sizeResult.rows[0].db_size}`);

    // Test full-text search
    if (documentsCount > 0) {
      console.log('\n🔍 Testing full-text search...');
      const searchResult = await client.query(`
        SELECT COUNT(*) as searchable_docs 
        FROM documents 
        WHERE search_vector IS NOT NULL
      `);
      console.log(`✅ Searchable documents: ${searchResult.rows[0].searchable_docs}/${documentsCount}`);
    }

  } catch (error) {
    console.error('❌ Error applying enhancements:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Enhanced search functions for server.js
const enhancedQueries = {
  // Full-text search với ranking
  async searchDocumentsFullText(query, companyId = null, limit = 10) {
    const client = await pool.connect();
    try {
      let sql = `
        SELECT d.*, c.code as company_code, c.full_name as company_name,
               ts_rank_cd(search_vector, plainto_tsquery('english', $1)) as rank,
               ts_headline('english', 
                 COALESCE(content_text, ''), 
                 plainto_tsquery('english', $1),
                 'MaxWords=50, MinWords=10'
               ) as highlight
        FROM documents d 
        LEFT JOIN companies c ON d.company_id = c.id
        WHERE search_vector @@ plainto_tsquery('english', $1)
      `;
      let params = [query];
      
      if (companyId) {
        sql += ` AND d.company_id = $2`;
        params.push(companyId);
      }
      
      sql += ` ORDER BY rank DESC, d.upload_date DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      
      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  },

  // Advanced search với filters
  async searchWithFilters(filters) {
    const client = await pool.connect();
    try {
      let sql = `
        SELECT d.*, c.code as company_code, c.full_name as company_name,
               cm.word_count, cm.page_count, cm.language,
               da.view_count, da.search_count
        FROM documents d
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN content_metadata cm ON d.id = cm.document_id
        LEFT JOIN document_analytics da ON d.id = da.document_id
        WHERE 1=1
      `;
      let params = [];
      let paramIndex = 1;

      // Text search với full-text
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

      // Add ranking for text search
      if (filters.query) {
        sql += ` ORDER BY ts_rank_cd(search_vector, plainto_tsquery('english', $1)) DESC, d.upload_date DESC`;
      } else {
        sql += ` ORDER BY d.upload_date DESC`;
      }
      
      if (filters.limit) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(filters.limit);
        paramIndex++;
      }

      const result = await client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  },

  // Update analytics
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
  }
};

// Run if called directly
if (require.main === module) {
  applyEnhancements().then(() => {
    console.log('✅ Enhancements applied successfully!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Failed to apply enhancements:', error);
    process.exit(1);
  });
}

module.exports = {
  applyEnhancements,
  enhancedQueries
}; 