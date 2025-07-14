const express = require('express');
const router = express.Router();
const companiesController = require('../controllers/companiesController');

// Get all companies
router.get('/', companiesController.getCompanies);

// Get company by code
router.get('/:code', companiesController.getCompanyByCode);

// Create company
router.post('/', companiesController.createCompany);

// Update company
router.put('/:id', companiesController.updateCompany);

// Delete company
router.delete('/:id', companiesController.deleteCompany);

module.exports = router; 