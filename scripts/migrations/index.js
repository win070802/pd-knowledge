const { pool } = require('../../src/config/database');
const { createTables } = require('./create-tables');
const { createMetadataTables } = require('./create-metadata-tables');
const { fixColumns } = require('./fix-columns');
const { addMissingColumns } = require('./add-missing-columns');
const { populateDefaultData } = require('./populate-default-data');
const { verifyMigration } = require('./verify-migration');

/**
 * Thực hiện toàn bộ quá trình migration database
 */
async function migrateDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Bắt đầu migration database toàn diện...');
    console.log('📊 Thông tin kết nối database:', process.env.DATABASE_URL ? 'Sử dụng DATABASE_URL' : 'Sử dụng DATABASE_PUBLIC_URL');
    console.log('🔒 SSL được bật:', process.env.SSL_ENABLED);
    
    // 1. Tạo tất cả các bảng nếu chưa tồn tại
    await createTables(client);
    
    // 2. Tạo các bảng metadata
    await createMetadataTables(client);
    
    // 3. Sửa các cột để đảm bảo tính nhất quán
    await fixColumns(client);
    
    // 4. Thêm các cột còn thiếu
    await addMissingColumns(client);
    
    // 5. Thêm dữ liệu mặc định
    await populateDefaultData(client);
    
    // 6. Xác minh kết quả migration
    await verifyMigration(client);
    
    console.log('✅ Migration database hoàn tất thành công');
    
  } catch (error) {
    console.error('❌ Migration thất bại:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { migrateDatabase }; 