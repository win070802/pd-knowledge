const { db } = require('../database');
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');

class FactoryResetService {
  constructor() {
    this.storage = null;
    this.bucket = null;
    this.initializeStorage();
  }

  initializeStorage() {
    try {
      const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      const keyFilePath = process.env.GOOGLE_CLOUD_KEY_FILE;
      
      if (credentialsJson) {
        const credentials = JSON.parse(credentialsJson);
        this.storage = new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          credentials: credentials
        });
        this.bucket = this.storage.bucket(process.env.GCS_BUCKET_NAME);
        console.log('☁️ Factory Reset: Google Cloud Storage initialized');
      } else if (keyFilePath && fs.existsSync(keyFilePath)) {
        this.storage = new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          keyFilename: keyFilePath
        });
        this.bucket = this.storage.bucket(process.env.GCS_BUCKET_NAME);
        console.log('☁️ Factory Reset: Google Cloud Storage initialized (keyFile)');
      } else {
        console.log('⚠️ Factory Reset: No Google Cloud credentials - will skip cloud storage cleanup');
      }
    } catch (error) {
      console.log('⚠️ Factory Reset: Failed to initialize Google Cloud Storage:', error.message);
    }
  }

  // Main factory reset function
  async performFactoryReset() {
    console.log('\n🚨 ===============================================');
    console.log('🚨 PERFORMING FACTORY RESET - DELETING ALL DATA');
    console.log('🚨 ===============================================\n');

    try {
      // 1. Clear Database Tables
      await this.clearDatabaseTables();
      
      // 2. Clear Local File System
      await this.clearLocalFiles();
      
      // 3. Clear Google Cloud Storage
      await this.clearCloudStorage();
      
      // 4. Reinitialize Database Schema
      await this.reinitializeDatabase();

      console.log('\n✅ ===============================================');
      console.log('✅ FACTORY RESET COMPLETED SUCCESSFULLY');
      console.log('✅ All data has been cleared and reset');
      console.log('✅ ===============================================\n');

      return true;
    } catch (error) {
      console.error('\n❌ Factory Reset Failed:', error);
      console.log('❌ Some data may not have been cleared properly\n');
      return false;
    }
  }

  // Clear all database tables
  async clearDatabaseTables() {
    console.log('🗃️ Clearing database tables...');
    
    try {
      const { pool } = require('../src/config/database');
      const client = await pool.connect();

      // Drop tables in correct order (respecting foreign keys)
      const dropQueries = [
        'DROP TABLE IF EXISTS questions CASCADE;',
        'DROP TABLE IF EXISTS knowledge_base CASCADE;',
        'DROP TABLE IF EXISTS document_chunks CASCADE;',
        'DROP TABLE IF EXISTS documents CASCADE;',
        'DROP TABLE IF EXISTS companies CASCADE;',
        'DROP TABLE IF EXISTS sensitive_rules CASCADE;',
        'DROP TABLE IF EXISTS users CASCADE;'
      ];

      for (const query of dropQueries) {
        await client.query(query);
      }

      client.release();
      console.log('✅ Database tables cleared');
    } catch (error) {
      console.error('❌ Failed to clear database tables:', error.message);
    }
  }

  // Clear local file system
  async clearLocalFiles() {
    console.log('📁 Clearing local files...');

    const foldersToClean = [
      './uploads',
      './temp',
      './temp-images'
    ];

    for (const folder of foldersToClean) {
      try {
        if (fs.existsSync(folder)) {
          await this.deleteFolder(folder);
          // Recreate empty folder
          fs.mkdirSync(folder, { recursive: true });
          console.log(`✅ Cleared and recreated: ${folder}`);
        }
      } catch (error) {
        console.error(`❌ Failed to clear ${folder}:`, error.message);
      }
    }
  }

  // Recursively delete folder contents
  async deleteFolder(folderPath) {
    if (fs.existsSync(folderPath)) {
      const files = fs.readdirSync(folderPath);
      
      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          await this.deleteFolder(filePath);
          fs.rmdirSync(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      }
    }
  }

  // Clear Google Cloud Storage
  async clearCloudStorage() {
    if (!this.storage || !this.bucket) {
      console.log('⚠️ Skipping cloud storage cleanup (not configured)');
      return;
    }

    console.log('☁️ Clearing Google Cloud Storage...');

    try {
      // List all files in bucket
      const [files] = await this.bucket.getFiles();
      
      if (files.length === 0) {
        console.log('✅ Cloud storage already empty');
        return;
      }

      console.log(`📄 Found ${files.length} files in cloud storage`);

      // Delete files in batches
      const deletePromises = files.map(file => {
        return file.delete().catch(error => {
          console.error(`❌ Failed to delete ${file.name}:`, error.message);
        });
      });

      await Promise.all(deletePromises);
      console.log('✅ Cloud storage cleared');
    } catch (error) {
      console.error('❌ Failed to clear cloud storage:', error.message);
    }
  }

  // Reinitialize database schema
  async reinitializeDatabase() {
    console.log('🔧 Reinitializing database schema...');
    
    try {
      // Use existing database initialization
      const { initializeDatabase } = require('../database');
      await initializeDatabase();
      console.log('✅ Database schema reinitialized');
    } catch (error) {
      console.error('❌ Failed to reinitialize database:', error.message);
    }
  }

  // Create default companies after reset
  async createDefaultCompanies() {
    console.log('🏢 Creating default companies...');
    
    try {
      const defaultCompanies = [
        {
          code: 'PDH',
          fullName: 'Phát Đạt Holdings',
          chairman: 'Nguyễn Văn Đạt',
          ceo: 'Dương Hồng Cẩm',
          description: 'Công ty mẹ thuộc Phát Đạt Group, chuyên về đầu tư và quản lý',
          keywords: ['PDH', 'Phát Đạt Holdings', 'Holdings']
        },
        {
          code: 'PDI',
          fullName: 'Phát Đạt Industrials',
          chairman: 'Phạm Trọng Hòa',
          ceo: 'Vũ Văn Luyến',
          description: 'Công ty thành viên thuộc Phát Đạt Group chuyên về công nghiệp',
          keywords: ['PDI', 'Phát Đạt Industrials', 'Industrials']
        }
      ];

      for (const company of defaultCompanies) {
        await db.createCompany(company);
        console.log(`✅ Created company: ${company.code} - ${company.fullName}`);
      }
    } catch (error) {
      console.error('❌ Failed to create default companies:', error.message);
    }
  }
}

// Main function to check and perform factory reset
async function checkFactoryReset() {
  const shouldReset = process.env.FACTORY_RESET === 'true';
  
  if (shouldReset) {
    console.log('\n🚨 FACTORY_RESET=true detected in environment variables');
    console.log('🚨 Proceeding with factory reset...\n');
    
    const resetService = new FactoryResetService();
    const success = await resetService.performFactoryReset();
    
    if (success) {
      // Create default companies after reset
      await resetService.createDefaultCompanies();
      
      console.log('\n🎯 Factory Reset completed successfully!');
      console.log('💡 Set FACTORY_RESET=false to disable this behavior\n');
    }
    
    return success;
  }
  
  return false;
}

module.exports = {
  FactoryResetService,
  checkFactoryReset
}; 