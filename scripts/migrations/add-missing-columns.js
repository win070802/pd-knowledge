const { pool } = require('../../src/config/database');

/**
 * Thêm các cột còn thiếu vào các bảng hiện có
 */
async function addMissingColumns(client) {
  console.log('🔍 Kiểm tra và thêm các cột còn thiếu...');
  
  // Kiểm tra bảng companies
  const companiesColumns = await client.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'companies'
  `);
  const companyCols = companiesColumns.rows.map(row => row.column_name);
  
  if (!companyCols.includes('parent_group')) {
    console.log('📝 Thêm cột còn thiếu: parent_group vào bảng companies');
    await client.query(`ALTER TABLE companies ADD COLUMN parent_group VARCHAR(255)`);
    console.log('✅ Đã thêm cột: parent_group');
  }
  
  if (!companyCols.includes('keywords')) {
    console.log('📝 Thêm cột còn thiếu: keywords vào bảng companies');
    await client.query(`ALTER TABLE companies ADD COLUMN keywords TEXT[]`);
    console.log('✅ Đã thêm cột: keywords');
  }

  // Kiểm tra bảng users
  const usersColumns = await client.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'users'
  `);
  const userCols = usersColumns.rows.map(row => row.column_name);
  
  if (!userCols.includes('email')) {
    console.log('📝 Thêm cột còn thiếu: email vào bảng users');
    await client.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
    console.log('✅ Đã thêm cột: email');
  }
  
  if (!userCols.includes('phone')) {
    console.log('📝 Thêm cột còn thiếu: phone vào bảng users');
    await client.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(20)`);
    console.log('✅ Đã thêm cột: phone');
  }
  
  if (!userCols.includes('birth_date')) {
    console.log('📝 Thêm cột còn thiếu: birth_date vào bảng users');
    await client.query(`ALTER TABLE users ADD COLUMN birth_date DATE`);
    console.log('✅ Đã thêm cột: birth_date');
  }
  
  if (!userCols.includes('position')) {
    console.log('📝 Thêm cột còn thiếu: position vào bảng users');
    await client.query(`ALTER TABLE users ADD COLUMN position VARCHAR(255)`);
    console.log('✅ Đã thêm cột: position');
  }
  
  if (!userCols.includes('location')) {
    console.log('📝 Thêm cột còn thiếu: location vào bảng users');
    await client.query(`ALTER TABLE users ADD COLUMN location VARCHAR(255)`);
    console.log('✅ Đã thêm cột: location');
  }

  // Kiểm tra bảng documents cho các cột còn thiếu
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
      console.log(`📝 Thêm cột còn thiếu: ${col.name} vào bảng documents`);
      try {
        await client.query(`ALTER TABLE documents ADD COLUMN ${col.name} ${col.type}`);
        console.log(`✅ Đã thêm cột: ${col.name}`);
      } catch (error) {
        console.error(`❌ Lỗi khi thêm cột ${col.name}:`, error.message);
      }
    }
  }

  // Kiểm tra bảng knowledge_base
  const knowledgeBaseColumns = await client.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'knowledge_base'
  `);
  const kbCols = knowledgeBaseColumns.rows.map(row => row.column_name);
  
  if (!kbCols.includes('metadata')) {
    console.log('📝 Thêm cột còn thiếu: metadata vào bảng knowledge_base');
    await client.query(`ALTER TABLE knowledge_base ADD COLUMN metadata JSONB`);
    console.log('✅ Đã thêm cột: metadata');
  }

  // Kiểm tra bảng sensitive_rules
  const sensitiveRulesColumns = await client.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'sensitive_rules'
  `);
  const srCols = sensitiveRulesColumns.rows.map(row => row.column_name);
  
  if (!srCols.includes('rule_name')) {
    console.log('📝 Thêm cột còn thiếu: rule_name vào bảng sensitive_rules');
    await client.query(`ALTER TABLE sensitive_rules ADD COLUMN rule_name VARCHAR(255)`);
    console.log('✅ Đã thêm cột: rule_name');
  }
  
  if (!srCols.includes('category')) {
    console.log('📝 Thêm cột còn thiếu: category vào bảng sensitive_rules');
    await client.query(`ALTER TABLE sensitive_rules ADD COLUMN category VARCHAR(100)`);
    console.log('✅ Đã thêm cột: category');
  }
  
  if (!srCols.includes('active')) {
    console.log('📝 Thêm cột còn thiếu: active vào bảng sensitive_rules');
    await client.query(`ALTER TABLE sensitive_rules ADD COLUMN active BOOLEAN DEFAULT TRUE`);
    console.log('✅ Đã thêm cột: active');
  }
}

module.exports = { addMissingColumns }; 