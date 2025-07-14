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
      // Ultra-high quality settings optimized for small fonts
      const options = {
        density: 600,           // Very high DPI for small text
        saveFilename: "page",
        savePath: this.tempDir,
        format: "png",          // Lossless format
        quality: 100           // Maximum quality
        // No fixed width/height to preserve aspect ratio
      };

      console.log(`Converting PDF to images (max ${maxPages} pages)...`);
      console.log(`PDF path: ${pdfPath}`);
      console.log(`Save path: ${this.tempDir}`);
      
      const convert = require('pdf2pic').fromPath(pdfPath, options);
      const results = [];
      
      for (let i = 1; i <= maxPages; i++) {
        try {
          console.log(`Attempting to convert page ${i}...`);
          const result = await convert(i, { responseType: "image" });
          
          if (result && result.path) {
            results.push(result);
            console.log(`✅ Converted page ${i}: ${result.path}`);
          } else {
            console.log(`❌ No result for page ${i}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Error converting page ${i}:`, error.message);
          
          // Try with bulk conversion instead
          if (i === 1) {
            console.log(`🔄 Trying bulk conversion...`);
            try {
              const bulkResults = await convert.bulk(-1, { responseType: "image" });
              console.log(`📊 Bulk conversion results:`, bulkResults.length);
              return bulkResults.slice(0, maxPages);
            } catch (bulkError) {
              console.log(`❌ Bulk conversion also failed:`, bulkError.message);
              break;
            }
          }
          break;
        }
      }

      return results;
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      throw error;
    }
  }

  // Extract text from image using OCR - optimized for small fonts
  async extractTextFromImage(imagePath) {
    try {
      console.log(`Extracting text from: ${imagePath}`);
      
      const { data: { text } } = await Tesseract.recognize(imagePath, 'vie+eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        // Optimized configuration for small Vietnamese fonts
        tessedit_pageseg_mode: '6',        // Uniform block of text
        tessedit_ocr_engine_mode: '1',     // LSTM neural network engine
        user_defined_dpi: '600',           // Match our high DPI images
        textord_min_xheight: '6',          // Lower minimum for small characters
        textord_really_old_xheight: '1',   // Better diacritic handling
        preserve_interword_spaces: '1',    // Keep word spacing
        // Vietnamese language support
        language_model_penalty_non_freq_dict_word: '0.3',
        language_model_penalty_non_dict_word: '0.5',
        load_system_dawg: '1',
        load_freq_dawg: '1'
      });

      // Basic cleanup for Vietnamese text
      const cleanedText = text
        .replace(/PHAT DAT ÍNH SA/g, 'PHÁT ĐẠT')
        .replace(/AN TOAN BAO MAT THONG TIN/g, 'AN TOÀN BẢO MẬT THÔNG TIN')
        .replace(/CHINH SACH/g, 'CHÍNH SÁCH');

      return cleanedText;
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