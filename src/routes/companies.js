const express = require('express');
const router = express.Router();
const companiesController = require('../controllers/companiesController');
const { authenticate, requireAdmin } = require('../middleware/auth');

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

module.exports = router; 