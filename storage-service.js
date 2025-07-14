const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

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

  async uploadFile(filePath, fileName) {
    if (this.useCloudStorage) {
      return await this.uploadToCloud(filePath, fileName);
    } else {
      return await this.uploadToLocal(filePath, fileName);
    }
  }

  async uploadToCloud(filePath, fileName) {
    try {
      console.log(`☁️ Uploading to cloud: ${fileName}`);
      const destination = `uploads/${fileName}`;
      
      await this.bucket.upload(filePath, {
        destination: destination,
        metadata: {
          contentType: 'application/pdf'
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
        storage: 'cloud'
      };
    } catch (error) {
      console.error('❌ Error uploading to cloud:', error);
      throw error;
    }
  }

  async uploadToLocal(filePath, fileName) {
    try {
      console.log(`�� Uploading to local: ${fileName}`);
      const uploadDir = './uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const destination = path.join(uploadDir, fileName);
      fs.copyFileSync(filePath, destination);
      
      console.log(`✅ Uploaded to local: ${destination}`);
      return {
        url: null,
        path: destination,
        storage: 'local'
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