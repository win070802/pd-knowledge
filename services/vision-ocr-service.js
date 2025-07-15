const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { convert } = require('pdf2pic');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { db } = require('../database');
require('dotenv').config();

class VisionOCRService {
  constructor() {
    this.tempDir = './temp-images';
    this.ensureTempDir();
    
    // Initialize Google Cloud Vision
    // Handle both local (keyFilename) and production (JSON credentials) environments
    let visionConfig = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    };

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      // Production: Parse JSON credentials from environment variable
      try {
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        visionConfig.credentials = credentials;
        console.log('🔑 Using JSON credentials for Google Cloud Vision');
      } catch (error) {
        console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', error);
        throw error;
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Local development: Use keyFilename
      visionConfig.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      console.log('🔑 Using keyFilename for Google Cloud Vision');
    } else {
      throw new Error('No Google Cloud credentials found. Set either GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS');
    }

    this.visionClient = new ImageAnnotatorClient(visionConfig);
    
    // Initialize Gemini AI for text correction and content analysis
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

  // Convert PDF to images with high quality settings
  async convertPDFToImages(pdfPath, maxPages = null) {
    // Use environment variable or default to 50 pages (was 10)
    const pageLimit = maxPages || parseInt(process.env.MAX_PDF_PAGES) || 50;
    try {
      const options = {
        density: 300,           // High DPI for Vision API
        saveFilename: "page",
        savePath: this.tempDir,
        format: "png",
        quality: 100,
        width: 2000,           // Good resolution for Vision API
        graphicsmagick: true
      };

      console.log(`📷 Converting PDF to images for Vision API (limit: ${pageLimit} pages)...`);
      
      const convert = require('pdf2pic').fromPath(pdfPath, options);
      const results = [];
      let actualPages = 0;
      
      for (let i = 1; i <= pageLimit; i++) {
        try {
          const result = await convert(i, { responseType: "image" });
          
          if (result && result.path) {
            results.push(result);
            actualPages = i;
            console.log(`✅ Converted page ${i}: ${result.path}`);
          } else {
            console.log(`📄 Reached end of PDF at page ${i-1}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Error converting page ${i}:`, error.message);
          if (i === 1) {
            // Try bulk conversion
            try {
              console.log(`🔄 Trying bulk conversion for all pages...`);
              const bulkResults = await convert.bulk(-1, { responseType: "image" });
              const limitedResults = bulkResults.slice(0, pageLimit);
              
              if (bulkResults.length > pageLimit) {
                console.log(`⚠️  PDF has ${bulkResults.length} pages, processing only first ${pageLimit} pages`);
                console.log(`💡 To process more pages, set MAX_PDF_PAGES environment variable`);
              }
              
              console.log(`✅ Bulk converted ${limitedResults.length} pages`);
              return limitedResults;
            } catch (bulkError) {
              console.log(`❌ Bulk conversion failed:`, bulkError.message);
            }
          }
          break;
        }
      }

      // Log conversion summary
      console.log(`📊 PDF conversion completed: ${results.length} pages processed`);
      if (actualPages === pageLimit) {
        console.log(`⚠️  Reached page limit (${pageLimit}). PDF might have more pages.`);
        console.log(`💡 To process more pages, set MAX_PDF_PAGES environment variable to higher value`);
      }

      return results;
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      throw error;
    }
  }

  // Extract text from image using Google Cloud Vision
  async extractTextFromImage(imagePath) {
    try {
      console.log(`🔍 Extracting text from image using Vision API: ${imagePath}`);
      
      const [result] = await this.visionClient.textDetection(imagePath);
      const detections = result.textAnnotations;
      
      if (!detections || detections.length === 0) {
        console.log('No text detected in image');
        return '';
      }
      
      // First detection contains the full text
      const fullText = detections[0].description;
      
      console.log(`✅ Vision API extracted ${fullText.length} characters`);
      return fullText;
      
    } catch (error) {
      console.error('Error in Vision API OCR:', error);
      return '';
    }
  }

  // Correct OCR text using AI with enhanced Vietnamese support
  async correctOCRText(rawText) {
    try {
      if (!rawText || rawText.trim().length < 10) {
        return rawText;
      }

      console.log(`🔧 Correcting OCR text (${rawText.length} characters) with AI...`);
      
      const prompt = `
Bạn là chuyên gia sửa chính tả và cải thiện văn bản tiếng Việt từ OCR. Nhiệm vụ:

NGUYÊN TẮC:
1. CHỈ sửa lỗi chính tả, dấu thanh và nhận dạng sai
2. KHÔNG thay đổi nội dung, ý nghĩa hoặc cấu trúc
3. Giữ nguyên format, số liệu, ngày tháng
4. Sửa tên công ty, chức vụ nếu bị sai
5. Cải thiện khả năng đọc nhưng giữ nguyên thông tin

CÁC LỖI THƯỜNG GẶP:
- Dấu thanh tiếng Việt: "nhan su" → "nhân sự"
- Chữ hoa/thường: "CONG TY" → "CÔNG TY"
- Ký tự đặc biệt: "§" → "Điều", "¢" → "Chương"
- Tên công ty: "PHAT DAT" → "PHÁT ĐẠT"
- Chức vụ: "GIAM DOC" → "GIÁM ĐỐC"

VĂN BẢN CẦN SỬA:
${rawText}

VĂN BẢN ĐÃ SỬA:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let correctedText = response.text().trim();
      
      // Clean up AI response
      if (correctedText.includes('VĂN BẢN ĐÃ SỬA:')) {
        correctedText = correctedText.split('VĂN BẢN ĐÃ SỬA:')[1].trim();
      }
      
      // Safety check
      if (!correctedText || correctedText.length < rawText.length * 0.3) {
        console.log('⚠️ Correction result too short, using original text');
        return rawText;
      }
      
      console.log(`✅ Text correction completed: ${rawText.length} → ${correctedText.length} chars`);
      return correctedText;
      
    } catch (error) {
      console.error('❌ Error correcting OCR text:', error);
      return rawText;
    }
  }

  // Classify document content to detect inappropriate or junk files
  async classifyDocumentContent(text, filename = '') {
    try {
      console.log(`🔍 Classifying document content...`);
      
      const prompt = `
Bạn là chuyên gia phân loại tài liệu doanh nghiệp. Phân tích văn bản và trả lời:

TIÊU CHÍ CHẤP NHẬN:
✅ Tài liệu công ty (quy định, quy trình, chính sách)
✅ Báo cáo, biên bản họp
✅ Hướng dẫn, sơ đồ tổ chức
✅ Hợp đồng, thỏa thuận
✅ Tài liệu tài chính, kiểm toán
✅ Văn bản pháp lý liên quan công ty

TIÊU CHÍ TỪ CHỐI:
❌ Nội dung không liên quan công ty
❌ Tài liệu cá nhân
❌ Văn bản tầm bậy, spam
❌ Nội dung nhạy cảm
❌ File rác, test, demo
❌ Quảng cáo, marketing không liên quan

FILENAME: ${filename}

CONTENT: ${text.substring(0, 2000)}...

Trả lời CHÍNH XÁC theo format:
{
  "accept": true/false,
  "category": "Quy định|Quy trình|Báo cáo|Hợp đồng|Tài chính|Khác",
  "confidence": 0.0-1.0,
  "reason": "Lý do ngắn gọn",
  "businessRelevance": "Mức độ liên quan công ty 0.0-1.0"
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let classificationText = response.text().trim();
      
      // Extract JSON from response
      const jsonMatch = classificationText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const classification = JSON.parse(jsonMatch[0]);
        console.log(`📊 Document classification:`, classification);
        return classification;
      }
      
      // Fallback classification
      return {
        accept: true,
        category: 'Khác',
        confidence: 0.5,
        reason: 'Unable to classify automatically',
        businessRelevance: 0.5
      };
      
    } catch (error) {
      console.error('❌ Error classifying document:', error);
      // Default to accept if classification fails
      return {
        accept: true,
        category: 'Khác',
        confidence: 0.3,
        reason: 'Classification error - defaulting to accept',
        businessRelevance: 0.3
      };
    }
  }

  // Check for duplicate documents using content similarity
  async checkForDuplicates(text, filename, companyId = null) {
    try {
      console.log(`🔍 Checking for duplicate documents...`);
      
      // Get existing documents from the same company
      let existingDocs = [];
      if (companyId) {
        // Get all documents and filter by company_id
        const allDocs = await db.getDocuments();
        existingDocs = allDocs.filter(doc => doc.company_id === companyId);
      }
      
      if (existingDocs.length === 0) {
        return { isDuplicate: false, similarDocs: [] };
      }
      
      // Use AI to check similarity
      const prompt = `
Bạn là chuyên gia phân tích độ tương đồng tài liệu. So sánh văn bản mới với các tài liệu hiện có:

VĂN BẢN MỚI:
Filename: ${filename}
Content: ${text.substring(0, 1500)}...

CÁC TÀI LIỆU HIỆN CÓ:
${existingDocs.slice(0, 5).map(doc => `
- ID: ${doc.id}
- Filename: ${doc.original_name}
- Content: ${doc.content_text ? doc.content_text.substring(0, 500) : 'No content'}...
`).join('\n')}

Phân tích và trả lời theo format JSON:
{
  "isDuplicate": true/false,
  "similarDocs": [
    {
      "id": number,
      "filename": "string",
      "similarity": 0.0-1.0,
      "reason": "Lý do tương đồng"
    }
  ],
  "recommendation": "merge|replace|keep_separate",
  "confidenceScore": 0.0-1.0
}

Lưu ý:
- similarity > 0.8: Trùng lặp cao
- similarity > 0.6: Có thể merge
- similarity < 0.4: Khác biệt, giữ riêng`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let analysisText = response.text().trim();
      
      // Extract JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log(`📊 Duplicate analysis:`, analysis);
        return analysis;
      }
      
      return { isDuplicate: false, similarDocs: [] };
      
    } catch (error) {
      console.error('❌ Error checking duplicates:', error);
      return { isDuplicate: false, similarDocs: [] };
    }
  }

  // Merge similar documents using AI
  async mergeSimilarDocuments(newText, existingDoc, mergeReason) {
    try {
      console.log(`🔗 Merging similar documents...`);
      
      const prompt = `
Bạn là chuyên gia merge tài liệu. Hãy kết hợp 2 tài liệu sau thành 1 tài liệu hoàn chỉnh:

LÝ DO MERGE: ${mergeReason}

TÀI LIỆU HIỆN CÓ:
${existingDoc.content_text}

TÀI LIỆU MỚI:
${newText}

YÊU CẦU MERGE:
1. Giữ thông tin đầy đủ từ cả 2 tài liệu
2. Loại bỏ thông tin trùng lặp
3. Sắp xếp theo logic (thời gian, mức độ quan trọng)
4. Đánh dấu nguồn nếu có thông tin xung đột
5. Giữ format và cấu trúc rõ ràng

TÀI LIỆU ĐÃ MERGE:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let mergedText = response.text().trim();
      
      // Clean up AI response
      if (mergedText.includes('TÀI LIỆU ĐÃ MERGE:')) {
        mergedText = mergedText.split('TÀI LIỆU ĐÃ MERGE:')[1].trim();
      }
      
      console.log(`✅ Documents merged successfully: ${mergedText.length} characters`);
      return mergedText;
      
    } catch (error) {
      console.error('❌ Error merging documents:', error);
      return newText; // Return new text if merge fails
    }
  }

  // Analyze document structure and content for Q&A
  async analyzeDocumentStructure(text) {
    try {
      console.log(`🔍 Analyzing document structure for Q&A...`);
      
      const prompt = `
Phân tích cấu trúc tài liệu để hỗ trợ hệ thống hỏi đáp:

CONTENT: ${text.substring(0, 3000)}...

Trả lời theo format JSON:
{
  "documentType": "Quy định|Quy trình|Báo cáo|Hợp đồng|Sơ đồ|Khác",
  "mainTopics": ["topic1", "topic2", "topic3"],
  "keyPoints": [
    {
      "section": "Phần nào",
      "content": "Nội dung chính",
      "importance": 1-5
    }
  ],
  "procedures": [
    {
      "step": 1,
      "description": "Bước 1",
      "details": "Chi tiết"
    }
  ],
  "keyTerms": ["term1", "term2"],
  "canAnswerQuestions": [
    "Có thể trả lời câu hỏi gì?",
    "Quy trình như thế nào?",
    "Ai là người phụ trách?"
  ]
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let analysisText = response.text().trim();
      
      // Extract JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log(`📊 Document structure analysis completed`);
        return analysis;
      }
      
      return {
        documentType: 'Khác',
        mainTopics: [],
        keyPoints: [],
        procedures: [],
        keyTerms: [],
        canAnswerQuestions: []
      };
      
    } catch (error) {
      console.error('❌ Error analyzing document structure:', error);
      return {
        documentType: 'Khác',
        mainTopics: [],
        keyPoints: [],
        procedures: [],
        keyTerms: [],
        canAnswerQuestions: []
      };
    }
  }

  // Process scanned PDF with Vision API
  async processScannedPDF(pdfPath, maxPages = 10) {
    try {
      console.log('🔍 Processing scanned PDF with Vision API...');
      
      // Convert PDF to images
      const images = await this.convertPDFToImages(pdfPath, maxPages);
      
      if (images.length === 0) {
        throw new Error('No images extracted from PDF');
      }

      let allText = '';
      
      // Extract text from each image using Vision API
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

      console.log(`✅ Vision API OCR completed. Extracted ${allText.length} characters`);
      
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

  // Enhanced document processing with all new features
  async processDocumentWithEnhancements(pdfPath, filename, originalName, companyId = null) {
    try {
      console.log(`🚀 Processing document with enhancements: ${originalName}`);
      
      // Step 1: Extract text (standard or OCR)
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(dataBuffer);
      let extractedText = data.text;
      
      // Use Vision API if standard extraction yields little text
      if (this.isScannedPDF(extractedText)) {
        console.log('📸 Using Vision API for scanned document...');
        extractedText = await this.processScannedPDF(pdfPath);
      }
      
      // Step 2: Classify content
      const classification = await this.classifyDocumentContent(extractedText, originalName);
      
      if (!classification.accept) {
        throw new Error(`Document rejected: ${classification.reason}`);
      }
      
      // Step 3: Check for duplicates
      const duplicateAnalysis = await this.checkForDuplicates(extractedText, originalName, companyId);
      
      // Step 4: Handle duplicates if found
      if (duplicateAnalysis.isDuplicate && duplicateAnalysis.recommendation === 'merge') {
        console.log('🔗 Merging with similar document...');
        const similarDoc = duplicateAnalysis.similarDocs[0];
        const existingDoc = await db.getDocumentById(similarDoc.id);
        
        if (existingDoc) {
          extractedText = await this.mergeSimilarDocuments(
            extractedText, 
            existingDoc, 
            similarDoc.reason
          );
        }
      }
      
      // Step 5: Analyze document structure
      const structureAnalysis = await this.analyzeDocumentStructure(extractedText);
      
      return {
        text: extractedText,
        classification: classification,
        duplicateAnalysis: duplicateAnalysis,
        structureAnalysis: structureAnalysis,
        processingMethod: this.isScannedPDF(data.text) ? 'Vision API OCR' : 'Standard PDF'
      };
      
    } catch (error) {
      console.error('❌ Error in enhanced document processing:', error);
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

module.exports = new VisionOCRService(); 