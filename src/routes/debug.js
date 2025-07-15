const express = require('express');
const router = express.Router();
const { debugSearch, debugDocument } = require('../controllers/debugController');
const { checkFactoryReset, FactoryResetService } = require('../../factory-reset');

// Debug search - test document search algorithm
router.post('/search', debugSearch);

// Debug document - test document processing
router.post('/document', debugDocument);

const reloadConstraints = async (req, res) => {
  try {
    const geminiService = require('../../gemini');
    const newConstraints = geminiService.constraintsService.reloadConstraints();
    
    res.json({
      success: true,
      message: 'Constraints reloaded successfully',
      constraintsCount: Object.keys(newConstraints.commonQuestions || {}).length,
      companiesCount: Object.keys(newConstraints.companies || {}).length
    });
  } catch (error) {
    console.error('Error reloading constraints:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Factory Reset API endpoint
router.post('/factory-reset', async (req, res) => {
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

// Factory Reset Status
router.get('/factory-reset-status', (req, res) => {
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

router.post('/reload-constraints', reloadConstraints);

module.exports = router; 