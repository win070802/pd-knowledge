const { pool } = require('../../src/config/database');

/**
 * Xác minh kết quả migration
 */
async function verifyMigration(client) {
  console.log('🔍 Đang xác minh kết quả migration...');
  
  // Kiểm tra tất cả các bảng tồn tại
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log('📊 Các bảng trong database:');
  tables.rows.forEach(table => {
    console.log(`  - ${table.table_name}`);
  });
  
  // Kiểm tra số lượng bản ghi
  const counts = await Promise.all([
    client.query('SELECT COUNT(*) FROM companies'),
    client.query('SELECT COUNT(*) FROM users'),
    client.query('SELECT COUNT(*) FROM documents'),
    client.query('SELECT COUNT(*) FROM conversations')
  ]);
  
  console.log('📈 Số lượng bản ghi:');
  console.log(`  - Companies: ${counts[0].rows[0].count}`);
  console.log(`  - Users: ${counts[1].rows[0].count}`);
  console.log(`  - Documents: ${counts[2].rows[0].count}`);
  console.log(`  - Conversations: ${counts[3].rows[0].count}`);
  
  console.log('✅ Xác minh migration thành công');
}

module.exports = { verifyMigration }; 