const { Client } = require('pg');
require('dotenv').config();

// Script để tạo database nếu chưa tồn tại trong CockroachDB
async function createDatabaseIfNotExists() {
  // Lấy thông tin kết nối từ biến môi trường
  const connectionString = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ Không tìm thấy DATABASE_PUBLIC_URL hoặc DATABASE_URL trong biến môi trường');
    process.exit(1);
  }
  
  console.log('🔍 Đang phân tích chuỗi kết nối database...');
  
  // Phân tích chuỗi kết nối để lấy thông tin
  let url;
  try {
    url = new URL(connectionString);
  } catch (error) {
    console.error('❌ Chuỗi kết nối không hợp lệ:', error.message);
    process.exit(1);
  }
  
  // Lấy thông tin kết nối
  const config = {
    user: url.username,
    password: url.password,
    host: url.hostname,
    port: url.port || 26257, // Port mặc định của CockroachDB
    ssl: process.env.SSL_ENABLED === 'true' || process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: process.env.SSL_REJECT_UNAUTHORIZED === 'true' || true
    } : false
  };
  
  // Lấy tên database từ URL
  const databaseName = url.pathname.substring(1); // Bỏ dấu / ở đầu
  
  if (!databaseName) {
    console.error('❌ Không tìm thấy tên database trong chuỗi kết nối');
    process.exit(1);
  }
  
  console.log(`🔄 Đang kiểm tra và tạo database '${databaseName}' nếu chưa tồn tại...`);
  
  // Kết nối đến CockroachDB với database mặc định (postgres)
  const client = new Client({
    ...config,
    database: 'postgres' // Kết nối đến database mặc định
  });
  
  try {
    await client.connect();
    console.log('✅ Kết nối thành công đến CockroachDB');
    
    // Kiểm tra xem database đã tồn tại chưa
    const checkResult = await client.query(`
      SELECT 1 FROM pg_database WHERE datname = $1
    `, [databaseName]);
    
    if (checkResult.rows.length === 0) {
      console.log(`📝 Database '${databaseName}' chưa tồn tại, đang tạo mới...`);
      
      // Tạo database mới
      await client.query(`CREATE DATABASE "${databaseName}"`);
      console.log(`✅ Đã tạo database '${databaseName}' thành công`);
    } else {
      console.log(`ℹ️ Database '${databaseName}' đã tồn tại`);
    }
  } catch (error) {
    console.error('❌ Lỗi khi tạo database:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
  
  console.log('🎉 Quá trình kiểm tra và tạo database hoàn tất');
}

// Thực thi hàm chính
createDatabaseIfNotExists()
  .then(() => {
    console.log('✅ Script hoàn tất');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Lỗi không xác định:', error);
    process.exit(1);
  }); 