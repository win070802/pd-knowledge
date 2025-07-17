const express = require('express');
const morgan = require('morgan');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

console.log(`🚀 Starting basic server with NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`🔌 Port configuration: ${PORT}`);

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

// Basic middleware
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple health check endpoint
app.get('/simple-health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Basic server is running'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'PD-Knowledge API Server',
    documentation: '/health',
    timestamp: new Date().toISOString()
  });
});

// API endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API is working',
    endpoints: [
      '/api/health',
      '/api/documents',
      '/api/companies',
      '/api/qa',
      '/api/learn',
      '/api/upload'
    ]
  });
});

// API QA endpoint
app.post('/api/qa/ask', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API is in maintenance mode',
    timestamp: new Date().toISOString(),
    question: req.body.question || '',
    answer: 'Hệ thống đang được bảo trì. Vui lòng thử lại sau.'
  });
});

// API Learn endpoint
app.post('/api/learn', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API is in maintenance mode',
    timestamp: new Date().toISOString(),
    data: req.body,
    result: 'Hệ thống đang được bảo trì. Vui lòng thử lại sau.'
  });
});

// API Upload endpoint
app.post('/api/upload', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API is in maintenance mode',
    timestamp: new Date().toISOString(),
    result: 'Hệ thống đang được bảo trì. Vui lòng thử lại sau.'
  });
});

// API Documents endpoint
app.get('/api/documents', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API is in maintenance mode',
    timestamp: new Date().toISOString(),
    documents: []
  });
});

// API Companies endpoint
app.get('/api/companies', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API is in maintenance mode',
    timestamp: new Date().toISOString(),
    companies: []
  });
});

// API Auth endpoints
app.post('/api/auth/login', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API is in maintenance mode',
    timestamp: new Date().toISOString(),
    token: 'maintenance-mode-token',
    user: {
      username: req.body.username || 'user',
      role: 'user'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Resource not found'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Basic server running on 0.0.0.0:${PORT}`);
}); 