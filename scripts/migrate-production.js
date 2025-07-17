const { pool } = require('../src/config/database');

// Comprehensive database migration script for production
async function migrateDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting comprehensive database migration...');
    console.log('📊 Database connection info:', process.env.DATABASE_URL ? 'Using DATABASE_URL' : 'Using DATABASE_PUBLIC_URL');
    console.log('🔒 SSL enabled:', process.env.SSL_ENABLED);
    
    // =====================================================
    // 1. CREATE ALL TABLES IF NOT EXISTS
    // =====================================================
    
    console.log('📋 Creating tables if they don\'t exist...');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        birth_date DATE,
        position VARCHAR(255),
        location VARCHAR(255),
        role VARCHAR(20) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table ensured');
    
    // Create companies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        parent_group VARCHAR(255),
        description TEXT,
        chairman VARCHAR(255),
        ceo VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Companies table ensured');

    // Đảm bảo cột parent_group tồn tại (nếu migrate từ schema cũ)
    const companiesColumns = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'companies'`);
    const companyCols = companiesColumns.rows.map(row => row.column_name);
    if (!companyCols.includes('parent_group')) {
      console.log('📝 Adding missing column: parent_group to companies');
      await client.query(`ALTER TABLE companies ADD COLUMN parent_group VARCHAR(255)`);
      console.log('✅ Added column: parent_group');
    }
    
    // Đảm bảo cột keywords tồn tại (nếu migrate từ schema cũ)
    if (!companyCols.includes('keywords')) {
      console.log('📝 Adding missing column: keywords to companies');
      await client.query(`ALTER TABLE companies ADD COLUMN keywords TEXT[]`);
      console.log('✅ Added column: keywords');
    }
    
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
    
    // Đảm bảo cột metadata tồn tại trong knowledge_base (nếu migrate từ schema cũ)
    const knowledgeBaseColumns = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_base'`);
    const kbCols = knowledgeBaseColumns.rows.map(row => row.column_name);
    if (!kbCols.includes('metadata')) {
      console.log('📝 Adding missing column: metadata to knowledge_base');
      await client.query(`ALTER TABLE knowledge_base ADD COLUMN metadata JSONB`);
      console.log('✅ Added column: metadata');
    }
    
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
      { name: 'page_count', type: 'INTEGER' },
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
          description: 'Công ty mẹ của Tập đoàn Phát Đạt',
          chairman: 'Nguyễn Văn Đạt',
          ceo: 'Bùi Quang Anh Vũ'
        },
        {
          code: 'PDI',
          full_name: 'Phát Đạt Industrial',
          description: 'Công ty công nghiệp của Tập đoàn Phát Đạt',
          chairman: 'Nguyễn Văn Nam',
          ceo: 'Trần Công Hiếu'
        },
        {
          code: 'PDE',
          full_name: 'Phát Đạt Energy',
          description: 'Công ty năng lượng của Tập đoàn Phát Đạt',
          chairman: 'Lê Văn Minh',
          ceo: 'Phạm Thị Hương'
        },
        {
          code: 'PDHOS',
          full_name: 'Phát Đạt Hospitality',
          description: 'Công ty khách sạn và du lịch của Tập đoàn Phát Đạt',
          chairman: 'Trần Văn Lộc',
          ceo: 'Nguyễn Thị Mai'
        },
        {
          code: 'RHS',
          full_name: 'Realty Holdings',
          description: 'Công ty bất động sản của Tập đoàn Phát Đạt',
          chairman: 'Vũ Văn Hùng',
          ceo: 'Lê Thị Lan'
        }
      ];
      
      for (const company of defaultCompanies) {
        await client.query(
          'INSERT INTO companies (code, full_name, description, chairman, ceo) VALUES ($1, $2, $3, $4, $5)',
          [company.code, company.full_name, company.description, company.chairman, company.ceo]
        );
        console.log(`✅ Added company: ${company.code} - ${company.full_name}`);
      }
    } else {
      console.log(`ℹ️  Companies already populated (${count} companies)`);
    }
    
    // =====================================================
    // 4. CREATE OR UPDATE DEFAULT ADMIN USER
    // =====================================================
    
    console.log('👤 Ensuring default admin user...');
    const bcrypt = require('bcrypt');
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const existingAdmin = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (existingAdmin.rows.length === 0) {
      console.log('📝 Creating default admin user...');
      await client.query(`
        INSERT INTO users (username, password, full_name, phone, birth_date, position, location, role, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        'admin',
        hashedPassword,
        'Trần Minh Khôi',
        '0988204060',
        '2002-08-07',
        'Nhân viên công nghệ thông tin',
        'Hồ Chí Minh, Việt Nam',
        'admin',
        true
      ]);
      console.log('✅ Default admin user created: admin/' + adminPassword);
    } else {
      console.log('🔄 Updating password for admin user...');
      await client.query('UPDATE users SET password = $1 WHERE username = $2', [hashedPassword, 'admin']);
      console.log('✅ Admin password updated: admin/' + adminPassword);
    }
    
    // =====================================================
    // 5. VERIFY MIGRATION SUCCESS
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
    
    // Check users count
    const finalUsersCount = await client.query('SELECT COUNT(*) FROM users');
    console.log(`👤 Users in database: ${finalUsersCount.rows[0].count}`);
    
    // Kiểm tra document_metadata table
    try {
      const metadataTable = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'document_metadata'
        );
      `);
      
      if (metadataTable.rows[0].exists) {
        console.log('✅ Metadata tables exist');
      } else {
        console.log('⚠️ Metadata tables do not exist, creating them now...');
        
        // Tạo metadata tables
        await client.query(`
          -- Document metadata table
          CREATE TABLE IF NOT EXISTS document_metadata (
            id SERIAL PRIMARY KEY,
            document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
            entities JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(document_id)
          );

          -- Company metadata table
          CREATE TABLE IF NOT EXISTS company_metadata (
            id SERIAL PRIMARY KEY,
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(company_id)
          );

          -- Validation logs table
          CREATE TABLE IF NOT EXISTS validation_logs (
            id SERIAL PRIMARY KEY,
            document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
            validation_type VARCHAR(100) NOT NULL,
            original_text TEXT,
            corrected_text TEXT,
            entities_found JSONB DEFAULT '{}',
            corrections_applied JSONB DEFAULT '[]',
            conflicts_resolved JSONB DEFAULT '[]',
            confidence_score DECIMAL(3,2) DEFAULT 0.0,
            processing_time_ms INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW()
          );

          -- Entity references table for fast lookup
          CREATE TABLE IF NOT EXISTS entity_references (
            id SERIAL PRIMARY KEY,
            entity_name VARCHAR(255) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
            company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
            confidence DECIMAL(3,2) DEFAULT 1.0,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `);
        
        console.log('✅ Metadata tables created');
      }
    } catch (error) {
      console.error('❌ Error checking metadata tables:', error.message);
    }
    
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