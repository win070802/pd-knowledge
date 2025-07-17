// Script thiết lập cơ sở dữ liệu CockroachDB
require('dotenv').config(); // Sử dụng file .env mặc định
const { Pool } = require('pg');

// Tạo pool kết nối đến CockroachDB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: process.env.SSL_REJECT_UNAUTHORIZED === 'true' || true
  }
});

// SQL để tạo các bảng cơ sở dữ liệu
const createTablesSQL = `
-- Bảng users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng companies
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  description TEXT,
  chairman VARCHAR(255),
  ceo VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng departments
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(code, company_id)
);

-- Bảng documents
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  storage_name VARCHAR(255),
  storage_path VARCHAR(255),
  storage_url VARCHAR(255),
  content_text TEXT,
  content_html TEXT,
  mime_type VARCHAR(100),
  file_size INTEGER,
  page_count INTEGER,
  classification VARCHAR(100),
  company_id INTEGER REFERENCES companies(id),
  department_id INTEGER REFERENCES departments(id),
  user_id INTEGER REFERENCES users(id),
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE,
  processed_date TIMESTAMP,
  processing_error TEXT,
  metadata JSONB
);

-- Bảng knowledge
CREATE TABLE IF NOT EXISTS knowledge (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  department_id INTEGER REFERENCES departments(id),
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng conversations
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  session_id UUID UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id),
  context JSONB DEFAULT '{}',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Bảng conversation_messages
CREATE TABLE IF NOT EXISTS conversation_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id),
  message_type VARCHAR(50) NOT NULL,  -- 'question' or 'answer'
  content TEXT NOT NULL,
  relevant_documents JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng constraints
CREATE TABLE IF NOT EXISTS constraints (
  id SERIAL PRIMARY KEY,
  pattern TEXT NOT NULL,
  answer TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng questions
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  document_ids INTEGER[],
  response_time INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng sensitive_rules
CREATE TABLE IF NOT EXISTS sensitive_rules (
  id SERIAL PRIMARY KEY,
  pattern TEXT NOT NULL,
  category VARCHAR(100),
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// Hàm thực thi thiết lập database
async function setupDatabase() {
  const client = await pool.connect();
  try {
    console.log('Đang kết nối đến CockroachDB...');
    console.log('Bắt đầu tạo các bảng...');
    
    await client.query(createTablesSQL);
    
    console.log('✅ Đã tạo các bảng thành công!');
    
    // Kiểm tra các bảng đã tạo
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\nDanh sách các bảng đã tạo:');
    result.rows.forEach((row, idx) => {
      console.log(`${idx + 1}. ${row.table_name}`);
    });
    
    // Tạo người dùng admin mặc định
    const hashedPassword = '$2b$10$5dwsS5snIRlKu8ka3Yf4leOBvF5zi5Plk.GwLv8cjO8bwqEH1wdgG'; // "admin123"
    
    try {
      await client.query(`
        INSERT INTO users (username, password, email, full_name, role) 
        VALUES ('admin', $1, 'admin@example.com', 'Admin User', 'admin')
        ON CONFLICT (username) DO NOTHING
      `, [hashedPassword]);
      
      console.log('\n✅ Đã tạo người dùng admin mặc định (username: admin, password: admin123)');
    } catch (err) {
      console.log('Người dùng admin đã tồn tại hoặc có lỗi khi tạo:', err.message);
    }
    
  } catch (err) {
    console.error('❌ Lỗi thiết lập database:', err);
  } finally {
    client.release();
    await pool.end();
    console.log('Đã đóng kết nối');
  }
}

// Chạy thiết lập
setupDatabase().catch(err => {
  console.error('❌ Lỗi không xác định:', err);
}); 