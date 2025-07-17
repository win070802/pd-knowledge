const { Pool } = require('pg');
require('dotenv').config();

// Xác định cấu hình SSL dựa trên biến môi trường
const isProduction = process.env.NODE_ENV === 'production';
const sslEnabled = process.env.SSL_ENABLED === 'true' || isProduction;
const rejectUnauthorized = process.env.SSL_REJECT_UNAUTHORIZED === 'true' || true;

console.log(`[Database] Môi trường: ${isProduction ? 'Production' : 'Development'}`);
console.log(`[Database] SSL: ${sslEnabled ? 'Bật' : 'Tắt'}, Reject Unauthorized: ${rejectUnauthorized ? 'Có' : 'Không'}`);

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
  ssl: sslEnabled ? {
    rejectUnauthorized: rejectUnauthorized
  } : false
});

// Kiểm tra kết nối database khi khởi động
const checkDatabaseConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Kết nối database thành công!');
    client.release();
  } catch (err) {
    console.error('❌ Lỗi kết nối database:', err);
  }
};

// Thực hiện kiểm tra kết nối
checkDatabaseConnection();

module.exports = { pool }; 