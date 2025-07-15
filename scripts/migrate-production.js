const { pool } = require('../src/config/database');

// Comprehensive database migration script for production
async function migrateDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting comprehensive database migration...');
    
    // =====================================================
    // 1. CREATE ALL TABLES IF NOT EXISTS
    // =====================================================
    
    console.log('📋 Creating tables if they don\'t exist...');
    
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
    console.log('✅ Companies table ensured');
    
    // Create documents table with all necessary columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER NOT NULL,
        content_text TEXT,
        company_id INTEGER REFERENCES companies(id),
        category VARCHAR(100),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE,
        metadata JSONB
      )
    `);
    console.log('✅ Documents table ensured');
    
    // Create other tables
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
    console.log('✅ Questions table ensured');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        chunk_text TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Document chunks table ensured');
    
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
    console.log('✅ Sensitive rules table ensured');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        keywords TEXT[],
        category VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Knowledge base table ensured');
    
    // =====================================================
    // 2. CHECK AND ADD MISSING COLUMNS TO EXISTING TABLES
    // =====================================================
    
    console.log('🔍 Checking for missing columns in existing tables...');
    
    // Check documents table columns
    const documentsColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      ORDER BY column_name
    `);
    
    const existingColumns = documentsColumns.rows.map(row => row.column_name);
    console.log('📄 Existing documents columns:', existingColumns.join(', '));
    
    // Required columns for documents table
    const requiredColumns = [
      { name: 'filename', type: 'VARCHAR(255) NOT NULL' },
      { name: 'original_name', type: 'VARCHAR(255) NOT NULL' },
      { name: 'file_path', type: 'VARCHAR(500) NOT NULL' },
      { name: 'file_size', type: 'INTEGER NOT NULL' },
      { name: 'content_text', type: 'TEXT' },
      { name: 'company_id', type: 'INTEGER REFERENCES companies(id)' },
      { name: 'category', type: 'VARCHAR(100)' },
      { name: 'upload_date', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
      { name: 'processed', type: 'BOOLEAN DEFAULT FALSE' },
      { name: 'metadata', type: 'JSONB' }
    ];
    
    // Add missing columns
    for (const col of requiredColumns) {
      if (!existingColumns.includes(col.name)) {
        console.log(`📝 Adding missing column: ${col.name}`);
        try {
          await client.query(`ALTER TABLE documents ADD COLUMN ${col.name} ${col.type}`);
          console.log(`✅ Added column: ${col.name}`);
        } catch (error) {
          console.error(`❌ Error adding column ${col.name}:`, error.message);
        }
      } else {
        console.log(`ℹ️  Column ${col.name} already exists`);
      }
    }
    
    // =====================================================
    // 3. POPULATE DEFAULT COMPANIES IF EMPTY
    // =====================================================
    
    console.log('🏢 Checking and populating default companies...');
    
    const companiesCount = await client.query('SELECT COUNT(*) FROM companies');
    const count = parseInt(companiesCount.rows[0].count);
    
    if (count === 0) {
      console.log('📝 Populating default companies...');
      
      const defaultCompanies = [
        {
          code: 'PDH',
          full_name: 'Phát Đạt Holdings',
          parent_group: 'Phát Đạt Group',
          description: 'Công ty mẹ của Tập đoàn Phát Đạt',
          keywords: ['PDH', 'Phát Đạt', 'Holdings', 'Tập đoàn']
        },
        {
          code: 'PDI',
          full_name: 'Phát Đạt Industrial',
          parent_group: 'Phát Đạt Group',
          description: 'Công ty công nghiệp của Tập đoàn Phát Đạt',
          keywords: ['PDI', 'Phát Đạt', 'Industrial', 'Công nghiệp']
        },
        {
          code: 'PDE',
          full_name: 'Phát Đạt Energy',
          parent_group: 'Phát Đạt Group',
          description: 'Công ty năng lượng của Tập đoàn Phát Đạt',
          keywords: ['PDE', 'Phát Đạt', 'Energy', 'Năng lượng']
        },
        {
          code: 'PDHH',
          full_name: 'Phát Đạt Hospitality',
          parent_group: 'Phát Đạt Group',
          description: 'Công ty khách sạn và du lịch của Tập đoàn Phát Đạt',
          keywords: ['PDHH', 'Phát Đạt', 'Hospitality', 'Khách sạn']
        },
        {
          code: 'RH',
          full_name: 'Realty Holdings',
          parent_group: 'Phát Đạt Group',
          description: 'Công ty bất động sản của Tập đoàn Phát Đạt',
          keywords: ['RH', 'Realty', 'Holdings', 'Bất động sản']
        }
      ];
      
      for (const company of defaultCompanies) {
        await client.query(
          'INSERT INTO companies (code, full_name, parent_group, description, keywords) VALUES ($1, $2, $3, $4, $5)',
          [company.code, company.full_name, company.parent_group, company.description, company.keywords]
        );
        console.log(`✅ Added company: ${company.code} - ${company.full_name}`);
      }
    } else {
      console.log(`ℹ️  Companies already populated (${count} companies)`);
    }
    
    // =====================================================
    // 4. VERIFY MIGRATION SUCCESS
    // =====================================================
    
    console.log('🔍 Verifying migration success...');
    
    // Check final documents table structure
    const finalColumns = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      ORDER BY ordinal_position
    `);
    
    console.log('📄 Final documents table structure:');
    finalColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check companies count
    const finalCompaniesCount = await client.query('SELECT COUNT(*) FROM companies');
    console.log(`🏢 Companies in database: ${finalCompaniesCount.rows[0].count}`);
    
    console.log('✅ Database migration completed successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration
migrateDatabase()
  .then(() => {
    console.log('🎉 Migration finished successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }); 