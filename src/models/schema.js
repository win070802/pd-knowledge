const { pool } = require('../config/database');

// Initialize database schema
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
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

    // Create documents table
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

    // Create sensitive_rules table for content filtering
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

    // Create knowledge_base table for company-specific Q&A
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

    // Create conversations table for conversation context tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        user_id VARCHAR(255),
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        context JSONB,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // Create conversation_messages table for individual Q&A in conversation
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
        message_type VARCHAR(50) NOT NULL, -- 'question' or 'answer'
        content TEXT NOT NULL,
        relevant_documents JSONB,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default admin user if not exists
    const bcrypt = require('bcrypt');
    const existingAdmin = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    
    if (existingAdmin.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('Admin@123123', 10);
      await client.query(`
        INSERT INTO users (username, password, full_name, phone, birth_date, position, location, role) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        'admin',
        hashedPassword,
        'Trần Minh Khôi',
        '0988204060',
        '2002-08-07',
        'Nhân viên công nghệ thông tin',
        'Hồ Chí Minh, Việt Nam',
        'admin'
      ]);
      console.log('✅ Default admin user created: admin/Admin@123123');
    }

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { initializeDatabase }; 