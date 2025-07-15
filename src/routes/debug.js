const express = require('express');
const router = express.Router();
const { debugSearch, debugDocument } = require('../controllers/debugController');
const { checkFactoryReset, FactoryResetService } = require('../../scripts/factory-reset');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Debug search endpoint (admin only)
router.post('/search', authenticate, requireAdmin, debugSearch);

// Debug document by ID (admin only)
router.get('/document/:id', authenticate, requireAdmin, debugDocument);

// System info endpoint (admin only)
router.get('/system-info', authenticate, requireAdmin, (req, res) => {
  try {
    const envVars = {
      NODE_ENV: process.env.NODE_ENV,
      MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
      UPLOAD_TIMEOUT_MINUTES: process.env.UPLOAD_TIMEOUT_MINUTES,
      API_TIMEOUT_MINUTES: process.env.API_TIMEOUT_MINUTES,
      MAX_PDF_PAGES: process.env.MAX_PDF_PAGES,
      GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID,
      GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.substring(0, 10)}...` : 'NOT_SET',
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT_SET',
      GOOGLE_APPLICATION_CREDENTIALS_JSON: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? 'SET' : 'NOT_SET',
      FACTORY_RESET: process.env.FACTORY_RESET
    };

    // Check which Vision service is being used
    let visionService = 'UNKNOWN';
    try {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        visionService = 'GOOGLE_CLOUD_VISION';
      } else {
        visionService = 'DEMO_SERVICE';
      }
    } catch (error) {
      visionService = 'ERROR_CHECKING';
    }

    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      visionService,
      environmentVariables: envVars,
      processInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reload constraints endpoint (admin only)
router.post('/reload-constraints', authenticate, requireAdmin, (req, res) => {
  try {
    // Force reload constraints
    delete require.cache[require.resolve('../../config/constraints.json')];
    
    res.json({
      success: true,
      message: 'Constraints reloaded successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Factory Reset API endpoint (admin only - DANGEROUS)
router.post('/factory-reset', authenticate, requireAdmin, async (req, res) => {
  try {
    console.log('🚨 Factory Reset API called');
    
    // Require confirmation
    const { confirm } = req.body;
    if (confirm !== 'DELETE_ALL_DATA') {
      return res.status(400).json({
        success: false,
        error: 'Factory reset requires confirmation. Send {"confirm": "DELETE_ALL_DATA"}',
        warning: 'This will permanently delete all documents, companies, and uploaded files!'
      });
    }

    // Perform factory reset
    const resetService = new FactoryResetService();
    const success = await resetService.performFactoryReset();
    
    if (success) {
      // Create default companies
      await resetService.createDefaultCompanies();
      
      res.json({
        success: true,
        message: 'Factory reset completed successfully',
        actions: [
          'All database tables dropped and recreated',
          'All local files deleted',
          'All cloud storage files deleted',
          'Default companies (PDH, PDI) created'
        ],
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Factory reset failed - check server logs for details'
      });
    }
  } catch (error) {
    console.error('Factory Reset API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Factory Reset Status (admin only)
router.get('/factory-reset-status', authenticate, requireAdmin, (req, res) => {
  const resetEnabled = process.env.FACTORY_RESET === 'true';
  
  res.json({
    success: true,
    factoryResetEnabled: resetEnabled,
    environment: process.env.NODE_ENV || 'development',
    warning: resetEnabled ? 'Factory reset is ENABLED - server will reset on restart' : null,
    instructions: {
      enableReset: 'Set FACTORY_RESET=true in environment variables',
      triggerReset: 'POST /api/debug/factory-reset with {"confirm": "DELETE_ALL_DATA"}',
      disableReset: 'Set FACTORY_RESET=false or remove the variable'
    }
  });
});

module.exports = router; 