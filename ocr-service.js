const Tesseract = require('tesseract.js');
const { convert } = require('pdf2pic');
const fs = require('fs');
const path = require('path');

class OCRService {
  constructor() {
    this.tempDir = './temp-images';
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Check if PDF is likely scanned (has very little text)
  isScannedPDF(extractedText) {
    if (!extractedText || extractedText.trim().length < 100) {
      return true;
    }
    
    // Check if text is mostly whitespace or special characters
    const meaningfulText = extractedText.replace(/\s+/g, '').replace(/[^a-zA-ZÀ-ỹ0-9]/g, '');
    return meaningfulText.length < 50;
  }

  // Convert PDF to images
  async convertPDFToImages(pdfPath, maxPages = 10) {
    try {
      const options = {
        density: 200,
        saveFilename: "page",
        savePath: this.tempDir,
        format: "jpg",
        width: 2000,
        height: 2000
      };

      const convert = require('pdf2pic').fromPath(pdfPath, options);
      const results = [];
      
      console.log(`Converting PDF to images (max ${maxPages} pages)...`);
      
      for (let i = 1; i <= maxPages; i++) {
        try {
          const result = await convert(i, { responseType: "image" });
          results.push(result);
          console.log(`Converted page ${i}`);
        } catch (error) {
          console.log(`No more pages or error at page ${i}`);
          break;
        }
      }

      return results;
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      throw error;
    }
  }

  // Extract text from image using OCR
  async extractTextFromImage(imagePath) {
    try {
      console.log(`Extracting text from: ${imagePath}`);
      
      const { data: { text } } = await Tesseract.recognize(imagePath, 'vie+eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      return text;
    } catch (error) {
      console.error('Error in OCR:', error);
      return '';
    }
  }

  // Process scanned PDF with OCR
  async processScannedPDF(pdfPath, maxPages = 10) {
    try {
      console.log('🔍 Processing scanned PDF with OCR...');
      
      // Convert PDF to images
      const images = await this.convertPDFToImages(pdfPath, maxPages);
      
      if (images.length === 0) {
        throw new Error('No images extracted from PDF');
      }

      let allText = '';
      
      // Extract text from each image
      for (const image of images) {
        const imagePath = image.path;
        const pageText = await this.extractTextFromImage(imagePath);
        
        if (pageText.trim()) {
          allText += `\n--- Trang ${images.indexOf(image) + 1} ---\n`;
          allText += pageText.trim() + '\n';
        }
        
        // Clean up image file
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      console.log(`✅ OCR completed. Extracted ${allText.length} characters`);
      return allText;

    } catch (error) {
      console.error('Error processing scanned PDF:', error);
      throw error;
    }
  }

  // Clean up temporary files
  cleanup() {
    try {
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(this.tempDir, file));
        });
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
  }
}

module.exports = new OCRService(); 