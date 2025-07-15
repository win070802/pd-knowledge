const { pool } = require('./src/config/database');

// Database migration script for production
async function migrateDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database migration...');
    
    // Check if company_id column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      AND column_name = 'company_id'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('📝 Adding company_id column to documents table...');
      
      // Add company_id column
      await client.query(`
        ALTER TABLE documents 
        ADD COLUMN company_id INTEGER REFERENCES companies(id)
      `);
      
      console.log('✅ company_id column added successfully');
    } else {
      console.log('ℹ️  company_id column already exists');
    }
    
    // Ensure all tables exist (run full schema)
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
    console.log('🎉 Migration finished');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }); 