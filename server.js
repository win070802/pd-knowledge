const express = require('express');
const morgan = require('morgan');
const fs = require('fs');
const { helmet, cors, limiter, errorHandler, notFoundHandler } = require('./src/middleware/security');
const routes = require('./src/routes/index');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

console.log(`🚀 Starting server with NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`🔌 Port configuration: ${PORT}`);
console.log(`🔐 SSL enabled: ${process.env.SSL_ENABLED}`);

// Xử lý lỗi không bắt được
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Không thoát process để server tiếp tục chạy
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Không thoát process để server tiếp tục chạy
});

// Create temp directory for file processing
const tempDir = './temp';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configurable timeouts via environment variables
const UPLOAD_TIMEOUT = parseInt(process.env.UPLOAD_TIMEOUT_MINUTES || '20') * 60 * 1000; // Default 20 minutes
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT_MINUTES || '10') * 60 * 1000; // Default 10 minutes
const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '100mb'; // Default 100MB

console.log(`🕒 Timeout configuration:`);
console.log(`   Upload timeout: ${UPLOAD_TIMEOUT / 60000} minutes`);
console.log(`   API timeout: ${API_TIMEOUT / 60000} minutes`);
console.log(`   Max file size: ${MAX_FILE_SIZE}`);

// Basic middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json({ limit: MAX_FILE_SIZE }));
app.use(express.urlencoded({ extended: true, limit: MAX_FILE_SIZE }));

// Thêm endpoint /simple-health đơn giản không phụ thuộc vào database
app.get('/simple-health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Server is running'
  });
});

// Thêm endpoint /health cho Railway
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Server is running'
  });
});

// Dynamic timeout based on request type and file size
app.use((req, res, next) => {
  let timeout = API_TIMEOUT; // Default timeout
  
  // Extended timeout for upload routes
  if (req.path.includes('/upload') || req.path.includes('/api/upload')) {
    timeout = UPLOAD_TIMEOUT;
    
    // Extra timeout for large files (if Content-Length header available)
    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > 5 * 1024 * 1024) { // > 5MB
      const extraTime = Math.min(contentLength / (1024 * 1024) * 60000, 600000); // 1 min per MB, max +10 min
      timeout += extraTime;
      console.log(`🕒 Large file detected (${(contentLength / 1024 / 1024).toFixed(1)}MB), extending timeout by ${(extraTime / 60000).toFixed(1)} minutes`);
    }
    
    console.log(`🕒 Upload timeout set to ${(timeout / 60000).toFixed(1)} minutes`);
  }
  
  req.setTimeout(timeout);
  res.setTimeout(timeout);
  next();
});

// Rate limiting for API routes
app.use('/api/', limiter);

// Add request logging middleware for API endpoints
app.use('/api', (req, res, next) => {
  const startTime = Date.now();
  console.log(`📝 API Request: ${req.method} ${req.path} - Started at ${new Date().toISOString()}`);
  
  // Capture response to log its status
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    console.log(`📝 API Response: ${req.method} ${req.path} - Status ${res.statusCode} - Duration ${duration}ms`);
    return originalSend.call(this, body);
  };
  
  next();
});

// Routes
app.use('/', routes);

// Enhanced error handling with more details
app.use((err, req, res, next) => {
  console.error('❌ ERROR DETAILS:');
  console.error(`Path: ${req.path}`);
  console.error(`Method: ${req.method}`);
  console.error(`Status: ${err.status || 500}`);
  console.error(`Message: ${err.message}`);
  console.error(`Stack: ${err.stack}`);
  
  // Use the original error handler
  errorHandler(err, req, res, next);
});

// 404 handler
app.use('*', notFoundHandler);

// Đảm bảo migrate schema trước khi start server
// Chuyển phần này vào hàm startServer để đảm bảo xử lý bất đồng bộ đúng cách
// Migration sẽ được thực hiện trong startup.sh

// Start server
async function startServer() {
  try {
    // Check for factory reset first - bọc trong try-catch để tránh lỗi
    try {
      const { checkFactoryReset } = require('./scripts/factory-reset');
      const wasReset = await checkFactoryReset();
      if (wasReset) {
        console.log('\n🔄 Factory reset was performed - system is in clean state');
        console.log('💡 To disable factory reset, set FACTORY_RESET=false\n');
      }
    } catch (resetError) {
      console.error('❌ Error checking factory reset:', resetError);
    }
    
    // Initialize database (or reinitialize if reset was performed)
    try {
      // Kiểm tra kết nối database trước
      const { pool } = require('./src/config/database');
      const client = await pool.connect();
      console.log('✅ Database connection successful');
      client.release();
      
      // Khởi tạo database nếu cần
      console.log('✅ Database ready');
    } catch (dbError) {
      console.error('❌ Error connecting to database:', dbError);
      console.error('⚠️ Continuing without database connection');
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
      console.log(`📄 API Documentation available at http://localhost:${PORT}/health`);
      console.log(`💬 Ready to answer questions about your documents!`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    // Không thoát process để server có thể tiếp tục khởi động
    console.error('⚠️ Continuing despite startup error');
  }
}

startServer(); 