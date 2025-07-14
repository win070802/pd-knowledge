const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const { db } = require('./database');

class StorageService {
  constructor() {
    this.storage = null;
    this.bucket = null;
    this.useCloudStorage = false;
    this.initializeStorage();
  }

  initializeStorage() {
    try {
      // Check if we have Google Cloud credentials
      const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      const keyFilePath = process.env.GOOGLE_CLOUD_KEY_FILE;
      
      if (credentialsJson) {
        // Use environment variable (production)
        const credentials = JSON.parse(credentialsJson);
        this.storage = new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          credentials: credentials
        });
        this.useCloudStorage = true;
        console.log('☁️ Using Google Cloud Storage (production)');
      } else if (keyFilePath && fs.existsSync(keyFilePath)) {
        // Use key file (development)
        this.storage = new Storage({
          keyFilename: keyFilePath,
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
        this.useCloudStorage = true;
        console.log('☁️ Using Google Cloud Storage (development)');
      } else {
        // Use local storage
        this.useCloudStorage = false;
        console.log('💾 Using local storage (fallback)');
      }

      if (this.useCloudStorage) {
        this.bucket = this.storage.bucket(process.env.GCS_BUCKET_NAME);
        console.log(`📦 Bucket: ${process.env.GCS_BUCKET_NAME}`);
      }
    } catch (error) {
      console.error('❌ Error initializing storage:', error);
      this.useCloudStorage = false;
      console.log('💾 Falling back to local storage');
    }
  }

  // Enhanced auto-detect company from filename or content
  async detectCompanyFromFile(fileName, content = null) {
    try {
      console.log(`🔍 Detecting company for file: ${fileName}`);
      const companies = await db.getCompanies();
      console.log(`📊 Found ${companies.length} companies in database`);
      
      // Clean filename for better detection
      const fileNameLower = fileName.toLowerCase();
      
      // Priority 1: Check for company code at the beginning of filename (like PDH-KT-QT01)
      for (const company of companies) {
        const companyCode = company.code.toLowerCase();
        console.log(`🔎 Testing company: ${company.code} against filename: ${fileName}`);
        
        // Pattern: COMPANY-... or COMPANY_... or starts with COMPANY
        const patterns = [
          new RegExp(`^${companyCode}-`, 'i'),  // PDH-KT-QT01
          new RegExp(`^${companyCode}_`, 'i'),  // PDH_KT_QT01
          new RegExp(`^${companyCode}[\\s\\.]`, 'i'), // PDH KT or PDH.KT
          new RegExp(`${companyCode}`, 'i')     // Anywhere in filename
        ];
        
        for (const pattern of patterns) {
          if (pattern.test(fileName)) {
            console.log(`🎯 Detected company ${company.code} from filename pattern: ${fileName}`);
            return company;
          }
        }
      }
      
      // Priority 2: Check keywords in filename
      for (const company of companies) {
        if (company.keywords) {
          for (const keyword of company.keywords) {
            if (fileNameLower.includes(keyword.toLowerCase())) {
              console.log(`🎯 Detected company ${company.code} from keyword: ${keyword}`);
              return company;
            }
          }
        }
      }

      // Check content if provided
      if (content) {
        const contentLower = content.toLowerCase();
        for (const company of companies) {
          if (contentLower.includes(company.code.toLowerCase()) || 
              contentLower.includes(company.full_name.toLowerCase())) {
            return company;
          }
          // Check keywords in content
          if (company.keywords) {
            for (const keyword of company.keywords) {
              if (contentLower.includes(keyword.toLowerCase())) {
                return company;
              }
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error detecting company:', error);
      return null;
    }
  }

  // Detect document category from filename
  detectCategoryFromFileName(fileName) {
    const fileNameLower = fileName.toLowerCase();
    
    // Category patterns based on common Vietnamese business document types
    const categoryPatterns = {
      'Quy trình': ['quy trinh', 'quy-trinh', 'qt', 'qtrinh', 'process', 'procedure'],
      'Quy định': ['quy dinh', 'quy-dinh', 'qd', 'qdinh', 'regulation', 'rule'],
      'Kiểm toán': ['kiem toan', 'kiem-toan', 'kt', 'audit'],
      'Tài chính': ['tai chinh', 'tai-chinh', 'tc', 'finance', 'financial'],
      'Nhân sự': ['nhan su', 'nhan-su', 'ns', 'hr', 'human resource'],
      'Quản lý': ['quan ly', 'quan-ly', 'ql', 'management'],
      'Chính sách': ['chinh sach', 'chinh-sach', 'cs', 'policy'],
      'Báo cáo': ['bao cao', 'bao-cao', 'bc', 'report'],
      'Hướng dẫn': ['huong dan', 'huong-dan', 'hd', 'guide', 'instruction'],
      'Sơ đồ': ['so do', 'so-do', 'sd', 'chart', 'diagram'],
      'Hợp đồng': ['hop dong', 'hop-dong', 'hd', 'contract'],
      'Thanh toán': ['thanh toan', 'thanh-toan', 'tt', 'payment']
    };
    
    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      for (const pattern of patterns) {
        if (fileNameLower.includes(pattern)) {
          console.log(`📂 Detected category: ${category} from pattern: ${pattern}`);
          return category;
        }
      }
    }
    
    return 'Tài liệu'; // Default category
  }

  async uploadFile(filePath, fileName, originalName = null, companyCode = null) {
    let company = null;
    
    // If company code provided, get company info
    if (companyCode) {
      company = await db.getCompanyByCode(companyCode.toUpperCase());
    }
    
    // If no company specified, try to auto-detect from original filename
    if (!company) {
      const detectFromName = originalName || fileName;
      company = await this.detectCompanyFromFile(detectFromName);
    }

    // Detect category from original filename
    const category = this.detectCategoryFromFileName(originalName || fileName);

    if (this.useCloudStorage) {
      return await this.uploadToCloud(filePath, fileName, company, category);
    } else {
      return await this.uploadToLocal(filePath, fileName, company, category);
    }
  }

  async uploadFileByCompany(filePath, fileName, companyCode) {
    return await this.uploadFile(filePath, fileName, null, companyCode);
  }

  async uploadToCloud(filePath, fileName, company = null, category = null) {
    try {
      console.log(`☁️ Uploading to cloud: ${fileName}`);
      
      // Organize by company/category folder structure
      let destination;
      if (company) {
        const categoryFolder = category || 'General';
        destination = `uploads/${company.code}/${categoryFolder}/${fileName}`;
        console.log(`📁 Organizing into: ${company.code}/${categoryFolder}/`);
      } else {
        // Reject upload if no company detected
        throw new Error('❌ Cannot determine company for this file. Please ensure filename contains company code (PDH, PDI, PDE, PDHH, RH) or declare new company.');
      }
      
      await this.bucket.upload(filePath, {
        destination: destination,
        metadata: {
          contentType: 'application/pdf',
          customMetadata: {
            companyCode: company ? company.code : 'general',
            companyName: company ? company.full_name : 'General'
          }
        }
      });
      
      // Get public URL
      const file = this.bucket.file(destination);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-01-2500' // Far future
      });
      
      console.log(`✅ Uploaded to cloud: ${destination}`);
      return {
        url: url,
        path: destination,
        storage: 'cloud',
        company: company
      };
    } catch (error) {
      console.error('❌ Error uploading to cloud:', error);
      throw error;
    }
  }

  async uploadToLocal(filePath, fileName, company = null, category = null) {
    try {
      console.log(`💾 Uploading to local: ${fileName}`);
      
      // Organize by company/category folder structure
      let uploadDir;
      if (company) {
        const categoryFolder = category || 'General';
        uploadDir = `./uploads/${company.code}/${categoryFolder}`;
        console.log(`📁 Organizing into: ${company.code}/${categoryFolder}/`);
      } else {
        // Reject upload if no company detected
        throw new Error('❌ Cannot determine company for this file. Please ensure filename contains company code (PDH, PDI, PDE, PDHH, RH) or declare new company.');
      }
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const destination = path.join(uploadDir, fileName);
      fs.copyFileSync(filePath, destination);
      
      console.log(`✅ Uploaded to local: ${destination}`);
      return {
        url: null,
        path: destination,
        storage: 'local',
        company: company
      };
    } catch (error) {
      console.error('❌ Error uploading to local:', error);
      throw error;
    }
  }

  async deleteFile(filePath) {
    if (this.useCloudStorage) {
      try {
        await this.bucket.file(filePath).delete();
        console.log(`🗑️ Deleted from cloud: ${filePath}`);
      } catch (error) {
        console.error('❌ Error deleting from cloud:', error);
      }
    } else {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted from local: ${filePath}`);
        }
      } catch (error) {
        console.error('❌ Error deleting from local:', error);
      }
    }
  }

  getStorageType() {
    return this.useCloudStorage ? 'cloud' : 'local';
  }

  async getFileUrl(filePath) {
    if (this.useCloudStorage) {
      try {
        const file = this.bucket.file(filePath);
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: '03-01-2500'
        });
        return url;
      } catch (error) {
        console.error('❌ Error getting file URL:', error);
        return null;
      }
    } else {
      return null;
    }
  }
}

module.exports = new StorageService(); 