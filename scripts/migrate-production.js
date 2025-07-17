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
    
    // Create users table - synchronized with production
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        full_name VARCHAR(255),
        phone VARCHAR(20),
        birth_date DATE,
        position VARCHAR(255),
        location VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table ensured');
    
    // Create companies table - synchronized with production
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        parent_group VARCHAR(255),
        description TEXT,
        chairman VARCHAR(255),
        ceo VARCHAR(255),
        keywords TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Companies table ensured');

    // Create departments table - missing in local migration
    await client.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        company_id INTEGER REFERENCES companies(id),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code, company_id)
      )
    `);
    console.log('✅ Departments table ensured');

    // Create conversations table - synchronized with production
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        session_id UUID UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id),
        context JSONB DEFAULT '{}',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
    console.log('✅ Conversations table ensured');
    
    // Create conversation_messages table - synchronized with production
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        message_type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        relevant_documents JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Conversation messages table ensured');

    // Create documents table - fully synchronized with production
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        storage_name VARCHAR(255),
        storage_path VARCHAR(255),
        storage_url VARCHAR(255),
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER,
        page_count INTEGER,
        content_text TEXT,
        content_html TEXT,
        mime_type VARCHAR(100),
        classification VARCHAR(100),
        company_id INTEGER REFERENCES companies(id),
        department_id INTEGER REFERENCES departments(id),
        user_id INTEGER REFERENCES users(id),
        category VARCHAR(100),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE,
        processed_date TIMESTAMP,
        processing_error TEXT,
        metadata JSONB
      )
    `);
    console.log('✅ Documents table ensured');
    
    // Create other tables - synchronized with production
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        document_ids INTEGER[],
        response_time INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        rule_name VARCHAR(255),
        pattern TEXT NOT NULL,
        category VARCHAR(100),
        description TEXT,
        active BOOLEAN DEFAULT TRUE,
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
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Knowledge base table ensured');
    
    // Create knowledge table - exists in production
    await client.query(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        company_id INTEGER REFERENCES companies(id),
        department_id INTEGER REFERENCES departments(id),
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Knowledge table ensured');
    
    // Create constraints table - exists in production
    await client.query(`
      CREATE TABLE IF NOT EXISTS constraints (
        id SERIAL PRIMARY KEY,
        pattern TEXT NOT NULL,
        answer TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Constraints table ensured');
    
    // Create metadata tables - synchronized with production
    await client.query(`
      CREATE TABLE IF NOT EXISTS document_metadata (
        id SERIAL PRIMARY KEY,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        entities JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(document_id)
      )
    `);
    console.log('✅ Document metadata table ensured');

    await client.query(`
      CREATE TABLE IF NOT EXISTS company_metadata (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id)
      )
    `);
    console.log('✅ Company metadata table ensured');

    await client.query(`
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
      )
    `);
    console.log('✅ Validation logs table ensured');

    await client.query(`
      CREATE TABLE IF NOT EXISTS entity_references (
        id SERIAL PRIMARY KEY,
        entity_name VARCHAR(255) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        confidence DECIMAL(3,2) DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Entity references table ensured');

    // =====================================================
    // 2. COLUMN MIGRATIONS AND FIXES
    // =====================================================
    
    console.log('🔄 Performing column migrations...');
    
    // Fix conversation_messages table columns
    const msgColsRes = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'conversation_messages'
    `);
    const msgCols = msgColsRes.rows.map(r => r.column_name);
    
    if (msgCols.includes('type') && !msgCols.includes('message_type')) {
      console.log('🔄 Renaming column type to message_type...');
      await client.query('ALTER TABLE conversation_messages RENAME COLUMN type TO message_type');
      console.log('✅ Renamed column type to message_type');
    }
    
    if (msgCols.includes('message') && !msgCols.includes('content')) {
      console.log('🔄 Renaming column message to content...');
      await client.query('ALTER TABLE conversation_messages RENAME COLUMN message TO content');
      console.log('✅ Renamed column message to content');
    }
    
    if (msgCols.includes('document_ids') && !msgCols.includes('relevant_documents')) {
      console.log('🔄 Converting document_ids to relevant_documents...');
      
      // Check the type of document_ids
      const columnTypeCheck = await client.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'conversation_messages' AND column_name = 'document_ids'
      `);
      
      if (columnTypeCheck.rows[0] && columnTypeCheck.rows[0].data_type === 'ARRAY') {
        await client.query(`ALTER TABLE conversation_messages ADD COLUMN relevant_documents JSONB DEFAULT '[]'::jsonb`);
        
        try {
          await client.query(`
            UPDATE conversation_messages 
            SET relevant_documents = COALESCE(
              (SELECT jsonb_agg(jsonb_build_object('id', x)) 
               FROM unnest(document_ids) AS x),
              '[]'::jsonb
            )
            WHERE document_ids IS NOT NULL
          `);
        } catch (error) {
          console.error('❌ Error converting document_ids:', error.message);
        }
        
        await client.query(`ALTER TABLE conversation_messages DROP COLUMN document_ids`);
      } else {
        await client.query(`ALTER TABLE conversation_messages RENAME COLUMN document_ids TO relevant_documents`);
        await client.query(`
          ALTER TABLE conversation_messages 
          ALTER COLUMN relevant_documents TYPE JSONB 
          USING COALESCE(relevant_documents::jsonb, '[]'::jsonb)
        `);
      }
      console.log('✅ Converted document_ids to relevant_documents');
    }
    
    // Remove unused session_id column from conversation_messages
    if (msgCols.includes('session_id')) {
      console.log('🔄 Removing unused session_id column...');
      await client.query('ALTER TABLE conversation_messages DROP COLUMN session_id');
      console.log('✅ Dropped column session_id');
    }

    // Fix conversations table - change session_id to UUID if needed
    const conversationCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'conversations' AND column_name = 'session_id'
    `);
    
    if (conversationCols.rows.length > 0) {
      const sessionIdType = conversationCols.rows[0].data_type;
      if (sessionIdType === 'character varying') {
        console.log('🔄 Converting session_id to UUID type...');
        try {
          await client.query(`
            ALTER TABLE conversations 
            ALTER COLUMN session_id TYPE UUID 
            USING session_id::UUID
          `);
          console.log('✅ Converted session_id to UUID');
        } catch (error) {
          console.error('❌ Error converting session_id to UUID:', error.message);
          console.log('ℹ️  This might be expected if data is not in UUID format');
        }
      }
    }

    // Check and add missing columns to existing tables
    console.log('🔍 Checking for missing columns...');
    
    // Check companies table
    const companiesColumns = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'companies'
    `);
    const companyCols = companiesColumns.rows.map(row => row.column_name);
    
    if (!companyCols.includes('parent_group')) {
      console.log('📝 Adding missing column: parent_group to companies');
      await client.query(`ALTER TABLE companies ADD COLUMN parent_group VARCHAR(255)`);
      console.log('✅ Added column: parent_group');
    }
    
    if (!companyCols.includes('keywords')) {
      console.log('📝 Adding missing column: keywords to companies');
      await client.query(`ALTER TABLE companies ADD COLUMN keywords TEXT[]`);
      console.log('✅ Added column: keywords');
    }

    // Check users table
    const usersColumns = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'users'
    `);
    const userCols = usersColumns.rows.map(row => row.column_name);
    
    if (!userCols.includes('email')) {
      console.log('📝 Adding missing column: email to users');
      await client.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
      console.log('✅ Added column: email');
    }
    
    if (!userCols.includes('phone')) {
      console.log('📝 Adding missing column: phone to users');
      await client.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(20)`);
      console.log('✅ Added column: phone');
    }
    
    if (!userCols.includes('birth_date')) {
      console.log('📝 Adding missing column: birth_date to users');
      await client.query(`ALTER TABLE users ADD COLUMN birth_date DATE`);
      console.log('✅ Added column: birth_date');
    }
    
    if (!userCols.includes('position')) {
      console.log('📝 Adding missing column: position to users');
      await client.query(`ALTER TABLE users ADD COLUMN position VARCHAR(255)`);
      console.log('✅ Added column: position');
    }
    
    if (!userCols.includes('location')) {
      console.log('📝 Adding missing column: location to users');
      await client.query(`ALTER TABLE users ADD COLUMN location VARCHAR(255)`);
      console.log('✅ Added column: location');
    }

    // Check documents table for missing columns
    const documentsColumns = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'documents'
    `);
    const docCols = documentsColumns.rows.map(row => row.column_name);
    
    const requiredDocColumns = [
      { name: 'storage_name', type: 'VARCHAR(255)' },
      { name: 'storage_path', type: 'VARCHAR(255)' },
      { name: 'storage_url', type: 'VARCHAR(255)' },
      { name: 'content_html', type: 'TEXT' },
      { name: 'mime_type', type: 'VARCHAR(100)' },
      { name: 'classification', type: 'VARCHAR(100)' },
      { name: 'department_id', type: 'INTEGER REFERENCES departments(id)' },
      { name: 'user_id', type: 'INTEGER REFERENCES users(id)' },
      { name: 'processed_date', type: 'TIMESTAMP' },
      { name: 'processing_error', type: 'TEXT' }
    ];
    
    for (const col of requiredDocColumns) {
      if (!docCols.includes(col.name)) {
        console.log(`📝 Adding missing column: ${col.name} to documents`);
        try {
          await client.query(`ALTER TABLE documents ADD COLUMN ${col.name} ${col.type}`);
          console.log(`✅ Added column: ${col.name}`);
        } catch (error) {
          console.error(`❌ Error adding column ${col.name}:`, error.message);
        }
      }
    }

    // Check knowledge_base table
    const knowledgeBaseColumns = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_base'
    `);
    const kbCols = knowledgeBaseColumns.rows.map(row => row.column_name);
    
    if (!kbCols.includes('metadata')) {
      console.log('📝 Adding missing column: metadata to knowledge_base');
      await client.query(`ALTER TABLE knowledge_base ADD COLUMN metadata JSONB`);
      console.log('✅ Added column: metadata');
    }

    // Check sensitive_rules table
    const sensitiveRulesColumns = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'sensitive_rules'
    `);
    const srCols = sensitiveRulesColumns.rows.map(row => row.column_name);
    
    if (!srCols.includes('rule_name')) {
      console.log('📝 Adding missing column: rule_name to sensitive_rules');
      await client.query(`ALTER TABLE sensitive_rules ADD COLUMN rule_name VARCHAR(255)`);
      console.log('✅ Added column: rule_name');
    }
    
    if (!srCols.includes('category')) {
      console.log('📝 Adding missing column: category to sensitive_rules');
      await client.query(`ALTER TABLE sensitive_rules ADD COLUMN category VARCHAR(100)`);
      console.log('✅ Added column: category');
    }
    
    if (!srCols.includes('active')) {
      console.log('📝 Adding missing column: active to sensitive_rules');
      await client.query(`ALTER TABLE sensitive_rules ADD COLUMN active BOOLEAN DEFAULT TRUE`);
      console.log('✅ Added column: active');
    }

    // =====================================================
    // 3. POPULATE DEFAULT DATA
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
    // 5. VERIFICATION
    // =====================================================
    
    console.log('🔍 Verifying migration success...');
    
    // Check all tables exist
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📊 Tables in database:');
    tables.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Check counts
    const counts = await Promise.all([
      client.query('SELECT COUNT(*) FROM companies'),
      client.query('SELECT COUNT(*) FROM users'),
      client.query('SELECT COUNT(*) FROM documents'),
      client.query('SELECT COUNT(*) FROM conversations')
    ]);
    
    console.log('📈 Data counts:');
    console.log(`  - Companies: ${counts[0].rows[0].count}`);
    console.log(`  - Users: ${counts[1].rows[0].count}`);
    console.log(`  - Documents: ${counts[2].rows[0].count}`);
    console.log(`  - Conversations: ${counts[3].rows[0].count}`);
    
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