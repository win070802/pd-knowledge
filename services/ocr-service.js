const Tesseract = require('tesseract.js');
const { convert } = require('pdf2pic');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class OCRService {
  constructor() {
    this.tempDir = './temp-images';
    this.ensureTempDir();
    // Initialize Gemini AI for text correction
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
      // Ultra-high quality settings optimized for small fonts with proper aspect ratio
      const options = {
        density: 600,           // Very high DPI for small text
        saveFilename: "page",
        savePath: this.tempDir,
        format: "png",          // Lossless format
        quality: 100,          // Maximum quality
        width: 2480,           // Fixed width in pixels (A4 at 600 DPI)
        // Don't set height - let it auto-calculate to preserve aspect ratio
        graphicsmagick: true   // Use GraphicsMagick for better quality
      };

      console.log(`Converting PDF to images (max ${maxPages} pages)...`);
      console.log(`PDF path: ${pdfPath}`);
      console.log(`Save path: ${this.tempDir}`);
      console.log(`📐 Using fixed width: ${options.width}px with auto-height to preserve aspect ratio`);
      
      const convert = require('pdf2pic').fromPath(pdfPath, options);
      const results = [];
      
      for (let i = 1; i <= maxPages; i++) {
        try {
          console.log(`Attempting to convert page ${i}...`);
          const result = await convert(i, { responseType: "image" });
          
          if (result && result.path) {
            results.push(result);
            
            // Check image dimensions to verify aspect ratio
            try {
              const sharp = require('sharp');
              const imageInfo = await sharp(result.path).metadata();
              console.log(`✅ Converted page ${i}: ${result.path}`);
              console.log(`📐 Image dimensions: ${imageInfo.width}x${imageInfo.height} (aspect ratio: ${(imageInfo.width/imageInfo.height).toFixed(2)})`);
            } catch (sharpError) {
              console.log(`✅ Converted page ${i}: ${result.path}`);
              console.log(`⚠️ Could not get image dimensions: ${sharpError.message}`);
            }
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
                
                // Try alternative approach with no fixed dimensions
                console.log(`🔄 Trying conversion without fixed dimensions...`);
                try {
                  const fallbackOptions = {
                    density: 600,
                    saveFilename: "page",
                    savePath: this.tempDir,
                    format: "png",
                    quality: 100,
                    graphicsmagick: true
                    // No width/height to let pdf2pic handle aspect ratio automatically
                  };
                  
                  const fallbackConvert = require('pdf2pic').fromPath(pdfPath, fallbackOptions);
                  const fallbackResults = await fallbackConvert.bulk(-1, { responseType: "image" });
                  console.log(`📊 Fallback conversion results:`, fallbackResults.length);
                  return fallbackResults.slice(0, maxPages);
                } catch (fallbackError) {
                  console.log(`❌ All conversion methods failed:`, fallbackError.message);
                  break;
                }
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
        // Optimized configuration for high-resolution Vietnamese fonts
        tessedit_pageseg_mode: '6',        // Uniform block of text
        tessedit_ocr_engine_mode: '1',     // LSTM neural network engine
        user_defined_dpi: '600',           // Match our high DPI images
        textord_min_xheight: '8',          // Adjusted for high-res images
        textord_really_old_xheight: '1',   // Better diacritic handling
        preserve_interword_spaces: '1',    // Keep word spacing
        // High-resolution image handling
        textord_tabvector_vertical_gap_fraction: '0.5',
        textord_tabvector_vertical_box_ratio: '0.375',
        // Vietnamese language support
        language_model_penalty_non_freq_dict_word: '0.3',
        language_model_penalty_non_dict_word: '0.5',
        load_system_dawg: '1',
        load_freq_dawg: '1',
        // Better quality settings for high-res images
        classify_enable_learning: '0',
        classify_enable_adaptive_matcher: '1'
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

  // Correct OCR text using AI
  async correctOCRText(rawText) {
    try {
      if (!rawText || rawText.trim().length < 10) {
        return rawText;
      }

      console.log(`🔧 Correcting OCR text (${rawText.length} characters)...`);
      
      const prompt = `
Bạn là chuyên gia sửa chính tả tiếng Việt. Nhiệm vụ của bạn là sửa lỗi chính tả trong văn bản được trích xuất từ OCR, đặc biệt là các tài liệu công ty.

NGUYÊN TẮC QUAN TRỌNG:
1. CHỈ sửa lỗi chính tả, KHÔNG thay đổi nội dung hoặc ý nghĩa
2. Sửa dấu thanh tiếng Việt bị thiếu hoặc sai
3. Sửa các từ bị nhận dạng sai phổ biến trong OCR
4. Giữ nguyên format, số liệu, tên riêng nếu có thể
5. Sửa các từ viết tắt công ty phổ biến

CÁC LỖI THƯỜNG GẶP TRONG OCR:
- "BAN TAI CHIN" → "BAN TÀI CHÍNH"
- "SƠ BO CHOC NANG" → "SƠ ĐỒ CHỨC NĂNG"  
- "PHAP CHE" → "PHÁP CHẾ"
- "QUAN LY" → "QUẢN LÝ"
- "KE TOAN" → "KẾ TOÁN"
- "NHAN SU" → "NHÂN SỰ"
- "CONG TY" → "CÔNG TY"
- "GIAM DOC" → "GIÁM ĐỐC"
- "CHU TICH" → "CHỦ TỊCH"

VĂN BẢN GỐC (từ OCR):
${rawText}

VĂN BẢN ĐÃ SỬA:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let correctedText = response.text().trim();
      
      // Remove AI response prefix if present
      if (correctedText.startsWith('VĂN BẢN ĐÃ SỬA:')) {
        correctedText = correctedText.replace(/^VĂN BẢN ĐÃ SỬA:\s*/, '').trim();
      }
      
      // If the result is empty or too short, return original
      if (!correctedText || correctedText.length < rawText.length * 0.5) {
        console.log('⚠️ Correction result too short, using original text');
        return rawText;
      }
      
      console.log(`✅ Text correction completed`);
      console.log(`📊 Original: ${rawText.length} chars → Corrected: ${correctedText.length} chars`);
      
      return correctedText;
    } catch (error) {
      console.error('❌ Error correcting OCR text:', error);
      console.log('🔄 Fallback: Using original text');
      return rawText; // Return original if correction fails
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
      
      // Apply AI-powered text correction
      if (allText.trim().length > 0) {
        const correctedText = await this.correctOCRText(allText);
        return correctedText;
      }
      
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