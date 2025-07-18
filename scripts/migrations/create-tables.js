const { pool } = require('../../src/config/database');

/**
 * Tạo tất cả các bảng trong database nếu chưa tồn tại
 */
async function createTables(client) {
  console.log('📋 Đang tạo các bảng nếu chưa tồn tại...');
  
  // Create users table
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
  console.log('✅ Đã đảm bảo bảng users');
  
  // Create companies table
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
  console.log('✅ Đã đảm bảo bảng companies');

  // Create departments table
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
  console.log('✅ Đã đảm bảo bảng departments');

  // Create conversations table
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
  console.log('✅ Đã đảm bảo bảng conversations');
  
  // Create conversation_messages table
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
  console.log('✅ Đã đảm bảo bảng conversation_messages');

  // Create documents table
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
  console.log('✅ Đã đảm bảo bảng documents');
  
  // Create questions table
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
  console.log('✅ Đã đảm bảo bảng questions');
  
  // Create document_chunks table
  await client.query(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id SERIAL PRIMARY KEY,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      chunk_text TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ Đã đảm bảo bảng document_chunks');
  
  // Create sensitive_rules table
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
  console.log('✅ Đã đảm bảo bảng sensitive_rules');
  
  // Create knowledge_base table
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
  console.log('✅ Đã đảm bảo bảng knowledge_base');
  
  // Create knowledge table
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
  console.log('✅ Đã đảm bảo bảng knowledge');
  
  // Create constraints table
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
  console.log('✅ Đã đảm bảo bảng constraints');
}

module.exports = { createTables }; 