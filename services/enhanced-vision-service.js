const fs = require('fs');
const path = require('path');
const { convert } = require('pdf2pic');

class EnhancedVisionService {
  constructor() {
    this.tempDir = './temp-images';
    this.hasVisionCredentials = this.checkVisionCredentials();
    this.ensureTempDir();
  }

  checkVisionCredentials() {
    try {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        return true;
      }
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS && 
          fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async processScannedPDF(pdfPath, maxPages = 20) {
    console.log('🔄 Processing PDF with enhanced fallback system...');
    
    if (!this.hasVisionCredentials) {
      console.log('⚠️  Vision API credentials not available, using fallback methods');
      return await this.fallbackProcessing(pdfPath);
    }
    
    try {
      // Try Vision API if credentials are available
      const visionOCRService = require('./vision-ocr-service');
      return await visionOCRService.processScannedPDF(pdfPath, maxPages);
    } catch (error) {
      console.log(`⚠️  Vision API failed (${error.message}), using fallback`);
      return await this.fallbackProcessing(pdfPath);
    }
  }

  async fallbackProcessing(pdfPath) {
    try {
      // Method 1: Standard PDF parsing
      console.log('🔄 Attempting standard PDF parsing...');
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(dataBuffer);
      
      if (data.text && data.text.trim().length > 50) {
        console.log(`✅ Standard parsing successful: ${data.text.length} characters`);
        return data.text;
      }
      
      // Method 2: Tesseract.js fallback for scanned PDFs
      console.log('🔄 Attempting Tesseract.js OCR fallback...');
      return await this.tesseractFallback(pdfPath);
      
    } catch (error) {
      console.error('❌ All fallback methods failed:', error.message);
      throw new Error(`PDF processing failed: ${error.message}. This PDF may require manual processing or Vision API credentials.`);
    }
  }

  async tesseractFallback(pdfPath) {
    try {
      const { createWorker } = require('tesseract.js');
      
      // Convert PDF to images
      const images = await this.convertPDFToImages(pdfPath, 5); // Limit to 5 pages for fallback
      
      if (images.length === 0) {
        throw new Error('Could not convert PDF to images');
      }
      
      let allText = '';
      const worker = await createWorker();
      
      try {
        await worker.loadLanguage('eng+vie');
        await worker.initialize('eng+vie');
        
        for (const image of images.slice(0, 3)) { // Process max 3 pages
          const { data: { text } } = await worker.recognize(image.path);
          if (text.trim()) {
            allText += `\n--- Trang ${images.indexOf(image) + 1} ---\n`;
            allText += text.trim() + '\n';
          }
          
          // Clean up temp image
          fs.unlinkSync(image.path);
        }
        
        await worker.terminate();
        
        if (allText.trim()) {
          console.log(`✅ Tesseract.js OCR successful: ${allText.length} characters`);
          return allText.trim();
        } else {
          throw new Error('No text extracted by Tesseract.js');
        }
        
      } catch (error) {
        await worker.terminate();
        throw error;
      }
      
    } catch (error) {
      console.error('❌ Tesseract.js fallback failed:', error.message);
      throw new Error(`OCR fallback failed: ${error.message}`);
    }
  }

  async convertPDFToImages(pdfPath, maxPages = 5) {
    try {
      const options = {
        density: 150,           // Lower DPI for fallback
        saveFilename: "fallback",
        savePath: this.tempDir,
        format: "png",
        quality: 90,
        width: 1200,           // Smaller size for fallback
      };

      console.log(`📷 Converting PDF to images for fallback OCR (limit: ${maxPages} pages)...`);
      
      const convert = require('pdf2pic').fromPath(pdfPath, options);
      const results = [];
      
      for (let i = 1; i <= maxPages; i++) {
        try {
          const result = await convert(i, { responseType: "image" });
          if (result && result.path) {
            results.push(result);
          } else {
            break;
          }
        } catch (error) {
          console.log(`❌ Error converting page ${i}: ${error.message}`);
          break;
        }
      }

      return results;
    } catch (error) {
      console.error('Error converting PDF to images for fallback:', error);
      return [];
    }
  }
}

module.exports = new EnhancedVisionService();