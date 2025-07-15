const express = require('express');
const morgan = require('morgan');
const fs = require('fs');
const { initializeDatabase } = require('./database');
const { helmet, cors, limiter, errorHandler, notFoundHandler } = require('./src/middleware/security');
const routes = require('./src/routes/index');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create temp directory for file processing
const tempDir = './temp';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Basic middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Increase timeout for file uploads and processing
app.use((req, res, next) => {
  // Set timeout to 10 minutes for upload routes
  if (req.path.includes('/upload') || req.path.includes('/api/upload')) {
    req.setTimeout(600000); // 10 minutes
    res.setTimeout(600000);
    console.log('🕒 Extended timeout for upload request');
  } else {
    req.setTimeout(300000); // 5 minutes for other routes
    res.setTimeout(300000);
  }
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

// Start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📄 API Documentation available at http://localhost:${PORT}/health`);
      console.log(`💬 Ready to answer questions about your documents!`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 