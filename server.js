const express = require('express');
const morgan = require('morgan');
const fs = require('fs');
const { helmet, cors, limiter, errorHandler, notFoundHandler } = require('./src/middleware/security');
const routes = require('./src/routes/index');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

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

// Routes
app.use('/', routes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', notFoundHandler);

// Đảm bảo migrate schema trước khi start server
if (process.env.NODE_ENV === 'production') {
  const { execSync } = require('child_process');
  try {
    console.log('🔄 Migrating database schema for production...');
    execSync('node scripts/migrate-production.js', { stdio: 'inherit' });
    console.log('✅ Database migrated!');
  } catch (err) {
    console.error('❌ Database migration failed:', err);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    // Check for factory reset first
    const { checkFactoryReset } = require('./scripts/factory-reset');
    const wasReset = await checkFactoryReset();
    
    // Initialize database (or reinitialize if reset was performed)
    // XÓA HOÀN TOÀN các dòng require hoặc gọi initializeDatabase
    // Đảm bảo chỉ migrate schema bằng migrate-production.js cho production
    
    console.log('Database ready');
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📄 API Documentation available at http://localhost:${PORT}/health`);
      console.log(`💬 Ready to answer questions about your documents!`);
      
      if (wasReset) {
        console.log('\n🔄 Factory reset was performed - system is in clean state');
        console.log('💡 To disable factory reset, set FACTORY_RESET=false\n');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 