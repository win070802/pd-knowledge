const express = require('express');
const router = express.Router();
const debugController = require('../controllers/debugController');

// Debug endpoint for testing document search
router.post('/search', debugController.debugSearch);

// Simple debug endpoint for documents
router.get('/docs/:id', debugController.debugDocument);

module.exports = router; 