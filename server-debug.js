const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Xử lý lỗi không bắt được
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Log environment variables
console.log(`🚀 Starting debug server with NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`🔌 Port configuration: ${PORT}`);
console.log(`📊 Database URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
console.log(`📊 Database Public URL: ${process.env.DATABASE_PUBLIC_URL ? 'Set' : 'Not set'}`);
console.log(`🔐 SSL enabled: ${process.env.SSL_ENABLED}`);
console.log(`🔐 SSL Reject Unauthorized: ${process.env.SSL_REJECT_UNAUTHORIZED}`);

// Basic middleware
app.use(express.json());

// Simple health check endpoint
app.get('/simple-health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Debug server is running'
  });
});

// Database test endpoint
app.get('/test-db', async (req, res) => {
  try {
    // Xác định cấu hình SSL dựa trên biến môi trường
    const isProduction = process.env.NODE_ENV === 'production';
    const sslEnabled = process.env.SSL_ENABLED === 'true' || isProduction;
    const rejectUnauthorized = process.env.SSL_REJECT_UNAUTHORIZED === 'true' || true;
    
    console.log(`[Test DB] Môi trường: ${isProduction ? 'Production' : 'Development'}`);
    console.log(`[Test DB] SSL: ${sslEnabled ? 'Bật' : 'Tắt'}, Reject Unauthorized: ${rejectUnauthorized ? 'Có' : 'Không'}`);
    console.log(`[Test DB] Connection string: ${process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL || 'Not set'}`);
    
    // Database connection configuration
    const pool = new Pool({
      connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL,
      ssl: sslEnabled ? {
        rejectUnauthorized: rejectUnauthorized
      } : false
    });
    
    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    client.release();
    
    res.status(200).json({
      status: 'OK',
      message: 'Database connection successful',
      time: result.rows[0].time,
      config: {
        ssl_enabled: sslEnabled,
        reject_unauthorized: rejectUnauthorized,
        connection_string_type: process.env.DATABASE_PUBLIC_URL ? 'DATABASE_PUBLIC_URL' : 
                               (process.env.DATABASE_URL ? 'DATABASE_URL' : 'None')
      }
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Database connection failed',
      error: error.message,
      stack: error.stack
    });
  }
});

// Environment info endpoint
app.get('/api/env', (req, res) => {
  res.status(200).json({
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 8080,
    database_url: process.env.DATABASE_URL ? 'Set' : 'Not set',
    database_public_url: process.env.DATABASE_PUBLIC_URL ? 'Set' : 'Not set',
    ssl_enabled: process.env.SSL_ENABLED || 'false',
    ssl_reject_unauthorized: process.env.SSL_REJECT_UNAUTHORIZED || 'false',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Debug server running on 0.0.0.0:${PORT}`);
}); 