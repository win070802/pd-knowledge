const express = require('express');
const router = express.Router();
const companiesController = require('../controllers/companiesController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { db } = require('../../database');

// Get all companies (public)
router.get('/', companiesController.getCompanies);

// Get company by code (public)
router.get('/:code', companiesController.getCompanyByCode);

// Create company (admin only)
router.post('/', authenticate, requireAdmin, companiesController.createCompany);

// Update company (admin only)
router.put('/:id', authenticate, requireAdmin, companiesController.updateCompany);

// Delete company (admin only)
router.delete('/:id', authenticate, requireAdmin, companiesController.deleteCompany);

// GET /api/companies/:companyId/metadata - Get standardized company metadata
router.get('/:companyId/metadata', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;
    console.log(`📊 Getting company metadata for: ${companyId}`);
    
    // Get company metadata from cross-document validation
    const CrossDocumentValidationService = require('../services/validation/crossDocumentValidationService');
    const validator = new CrossDocumentValidationService();
    
    const metadata = await validator.getCompanyMetadata(companyId);
    
    // Get additional statistics
    const documents = await db.getDocuments();
    const companyDocs = documents.filter(doc => doc.company_id === companyId);
    
    const response = {
      success: true,
      companyId,
      metadata: metadata,
      statistics: {
        totalDocuments: companyDocs.length,
        lastUpdated: metadata.dataQuality?.lastUpdated || null,
        confidenceScore: metadata.dataQuality?.confidenceScore || 0,
        entitiesExtracted: metadata.dataQuality?.entitiesExtracted || 0
      }
    };
    
    console.log(`✅ Retrieved metadata for ${companyId}: ${response.statistics.totalDocuments} documents`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error getting company metadata:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get company metadata',
      details: error.message 
    });
  }
});

// GET /api/companies/:companyId/entities/:entityType - Search specific entity type
router.get('/:companyId/entities/:entityType', authenticate, async (req, res) => {
  try {
    const { companyId, entityType } = req.params;
    const { search } = req.query;
    
    console.log(`🔍 Searching ${entityType} entities for ${companyId}`, search ? `with query: ${search}` : '');
    
    const CrossDocumentValidationService = require('../services/validation/crossDocumentValidationService');
    const validator = new CrossDocumentValidationService();
    
    const matches = await validator.searchEntityAcrossDocuments(
      search || '',
      entityType,
      companyId
    );
    
    res.json({
      success: true,
      companyId,
      entityType,
      searchQuery: search || '',
      matches: matches,
      totalMatches: matches.length
    });
    
  } catch (error) {
    console.error('❌ Error searching entities:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search entities',
      details: error.message 
    });
  }
});

// GET /api/companies/:companyId/validation-logs - Get validation logs for debugging
router.get('/:companyId/validation-logs', authenticate, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { limit = 50 } = req.query;
    
    console.log(`📋 Getting validation logs for ${companyId}`);
    
    const result = await db.query(`
      SELECT vl.*, d.original_name 
      FROM validation_logs vl
      JOIN documents d ON vl.document_id = d.id
      WHERE d.company_id = $1
      ORDER BY vl.created_at DESC
      LIMIT $2
    `, [companyId, parseInt(limit)]);
    
    const logs = result.rows.map(log => ({
      id: log.id,
      document: log.original_name,
      documentId: log.document_id,
      validationType: log.validation_type,
      correctionsApplied: JSON.parse(log.corrections_applied || '[]').length,
      conflictsResolved: JSON.parse(log.conflicts_resolved || '[]').length,
      confidenceScore: log.confidence_score,
      processingTime: log.processing_time_ms,
      createdAt: log.created_at
    }));
    
    res.json({
      success: true,
      companyId,
      logs: logs,
      totalLogs: logs.length
    });
    
  } catch (error) {
    console.error('❌ Error getting validation logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get validation logs',
      details: error.message 
    });
  }
});

module.exports = router; 