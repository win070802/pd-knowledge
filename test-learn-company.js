// Temporary test script for document-company learning
require('dotenv').config();
const { initializeDatabase } = require('./database');
const learnController = require('./src/controllers/learnController');

async function testLearnDocumentCompany() {
  try {
    console.log('🧪 Testing learn document-company mapping...');
    
    // Initialize database connection
    await initializeDatabase();
    
    // Mock request object
    const req = {
      body: {
        filename: 'QT.01(QT soan-chuyen-luu VB)LSX01_NHL200524.pdf',
        companyCode: 'PDI'
      }
    };
    
    // Mock response object
    const res = {
      json: (data) => {
        console.log('✅ Response:', JSON.stringify(data, null, 2));
      },
      status: (code) => {
        console.log(`📡 Status: ${code}`);
        return res;
      }
    };
    
    // Call the function
    await learnController.learnDocumentCompany(req, res);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

testLearnDocumentCompany(); 