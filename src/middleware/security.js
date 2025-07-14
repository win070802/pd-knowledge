const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Error handling middleware
const errorHandler = (error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large' });
    }
  }
  
  res.status(500).json({ success: false, error: 'Internal server error' });
};

// 404 handler
const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
};

module.exports = {
  helmet,
  cors,
  limiter,
  errorHandler,
  notFoundHandler
}; 