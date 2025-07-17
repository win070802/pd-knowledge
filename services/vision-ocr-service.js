const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { convert } = require('pdf2pic');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { db: defaultDb } = require('../database');
require('dotenv').config();

class VisionOCRService {
  constructor() {
    this.tempDir = './temp-images';
    this.ensureTempDir();
    this.db = defaultDb; // Default database connection
    
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
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Set database connection
  setDbConnection(dbConnection) {
    try {
      // Kiểm tra xem dbConnection có hợp lệ không
      if (!dbConnection) {
        console.error('❌ Invalid database connection provided to VisionOCRService');
        throw new Error('Invalid database connection');
      }

      // Kiểm tra các phương thức cần thiết
      const requiredMethods = ['updateDocument', 'getDocuments', 'getDocumentById'];
      for (const method of requiredMethods) {
        if (typeof dbConnection[method] !== 'function') {
          console.error(`❌ Database connection missing required method: ${method}`);
          throw new Error(`Database connection missing required method: ${method}`);
        }
      }

      this.db = dbConnection;
      
      // Thiết lập kết nối cho crossDocValidator nếu đã được khởi tạo
      if (this.crossDocValidator && typeof this.crossDocValidator.setDbConnection === 'function') {
        this.crossDocValidator.setDbConnection(dbConnection);
        console.log('✅ Database connection set for Cross-Document Validator');
      }
      
      // Kiểm tra kết nối bằng cách thực hiện truy vấn đơn giản
      this.testDatabaseConnection()
        .then(result => {
          if (result) {
            console.log('✅ Database connection verified for VisionOCRService');
          }
        })
        .catch(err => {
          console.error('❌ Database connection test failed:', err);
        });
      
      return true;
    } catch (error) {
      console.error('❌ Error setting database connection:', error);
      throw error;
    }
  }

  // Test database connection
  async testDatabaseConnection() {
    try {
      if (!this.db) {
        return false;
      }
      
      // Kiểm tra xem có thể truy cập các phương thức cơ bản không
      return typeof this.db.getDocuments === 'function' && 
             typeof this.db.updateDocument === 'function';
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
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
    // Use environment variable or default to 100 pages (was 10)
    const pageLimit = maxPages || parseInt(process.env.MAX_PDF_PAGES) || 100;
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
        const allDocs = await this.db.getDocuments();
        existingDocs = allDocs.filter(doc => doc.company_id === companyId);
      }
      
      if (existingDocs.length === 0) {
        return { isDuplicate: false, similarDocs: [] };
      }
      
      // Đầu tiên so sánh tên file để ngăn chặn merge các file khác loại
      const filenameParts = originalName.toLowerCase().split(/[\s\-\.\_]+/);
      
      // Các từ khóa để so sánh tên file
      const significantKeywords = filenameParts.filter(part => part.length > 3);
      
      // Lọc ra các tài liệu không thuộc phòng ban khác nhau
      let filteredDocs = [];
      for (const doc of existingDocs) {
        // Kiểm tra nếu tài liệu thuộc phòng ban khác nhau
        if (this.filesReferToDifferentEntities(originalName, doc.original_name)) {
          console.log(`🚫 Files appear to refer to different departments/entities: "${originalName}" vs "${doc.original_name}"`);
          continue; // Skip this document from consideration for merging
        }
        filteredDocs.push(doc);
      }
      
      // Nếu không còn tài liệu nào sau khi lọc, không có trùng lặp
      if (filteredDocs.length === 0) {
        console.log(`✅ No similar documents found after filtering by department`);
        return { isDuplicate: false, similarDocs: [] };
      }
      
      // Now run the AI-based duplicate check with filtered documents
      const duplicateAnalysis = await this.checkForDuplicates(text, originalName, companyId);
      
      // Additional check: Override recommendation if we detect critical differences in filename
      if (duplicateAnalysis.similarDocs && duplicateAnalysis.similarDocs.length > 0) {
        const filteredSimilarDocs = [];
        
        for (const similarDoc of duplicateAnalysis.similarDocs) {
          const existingDoc = await this.db.getDocumentById(similarDoc.id);
          if (existingDoc && this.filesReferToDifferentEntities(originalName, existingDoc.original_name)) {
            console.log(`🔒 Excluding document from merge due to different entities in filenames: ${existingDoc.original_name}`);
            // Skip this document
          } else {
            filteredSimilarDocs.push(similarDoc);
          }
        }
        
        // Update the similarDocs array with filtered results
        duplicateAnalysis.similarDocs = filteredSimilarDocs;
        
        // If no similar docs left after filtering, set isDuplicate to false
        if (filteredSimilarDocs.length === 0) {
          duplicateAnalysis.isDuplicate = false;
          duplicateAnalysis.recommendation = 'keep_separate';
          console.log(`✅ No similar documents left after department filtering`);
        }
      }
      
      return duplicateAnalysis;
    } catch (error) {
      console.error('❌ Error in enhanced duplicate check:', error);
      return { isDuplicate: false, similarDocs: [], recommendation: 'keep_separate' };
    }
  }
  
  // Helper to check if filenames refer to different departments/entities
  filesReferToDifferentEntities(filename1, filename2) {
    if (!filename1 || !filename2) return false;
    
    const normalize = (text) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const name1 = normalize(filename1);
    const name2 = normalize(filename2);
    
    // Danh sách phòng ban, bộ phận thường gặp
    const departments = {
      "phap_che": ["phap che", "ban phap che", "phong phap che", "bo phan phap che", "pháp chế", "phapche", "pc"],
      "tai_chinh": ["tai chinh", "ban tai chinh", "phong tai chinh", "bo phan tai chinh", "tài chính", "taichinh", "tc", "kt-qt", "kt"],
      "ke_toan": ["ke toan", "ban ke toan", "phong ke toan", "bo phan ke toan", "kế toán", "ketoan", "kt"],
      "nhan_su": ["nhan su", "ban nhan su", "phong nhan su", "bo phan nhan su", "nhân sự", "nhansu", "ns"],
      "it": ["it", "cntt", "cong nghe thong tin", "ban cntt", "công nghệ thông tin", "thông tin"],
      "san_xuat": ["san xuat", "ban san xuat", "phong san xuat", "bộ phận sản xuất", "sản xuất", "sx"],
      "kinh_doanh": ["kinh doanh", "ban kinh doanh", "phong kinh doanh", "bộ phận kinh doanh", "kd"]
    };
    
    const dept1 = this.extractDepartment(filename1);
    const dept2 = this.extractDepartment(filename2);
    
    console.log(`📊 Extracted departments: "${dept1}" vs "${dept2}" from "${filename1}" vs "${filename2}"`);
    
    // If both have departments detected and they're different
    if (dept1 && dept2 && dept1 !== dept2) {
      console.log(`🔎 Found different departments: "${dept1}" vs "${dept2}"`);
      return true;
    }
    
    return false;
  }
  
  // Extract department from filename
  extractDepartment(filename) {
    if (!filename) return null;
    
    const normalize = (text) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normalizedName = normalize(filename);
    
    // Danh sách phòng ban, bộ phận thường gặp
    const departments = {
      "phap_che": ["phap che", "ban phap che", "phong phap che", "bo phan phap che", "pháp chế", "phapche", "pc"],
      "tai_chinh": ["tai chinh", "ban tai chinh", "phong tai chinh", "bo phan tai chinh", "tài chính", "taichinh", "tc", "kt-qt", "kt"],
      "ke_toan": ["ke toan", "ban ke toan", "phong ke toan", "bo phan ke toan", "kế toán", "ketoan", "kt"],
      "nhan_su": ["nhan su", "ban nhan su", "phong nhan su", "bo phan nhan su", "nhân sự", "nhansu", "ns"],
      "it": ["it", "cntt", "cong nghe thong tin", "ban cntt", "công nghệ thông tin", "thông tin"],
      "san_xuat": ["san xuat", "ban san xuat", "phong san xuat", "bộ phận sản xuất", "sản xuất", "sx"],
      "kinh_doanh": ["kinh doanh", "ban kinh doanh", "phong kinh doanh", "bộ phận kinh doanh", "kd"]
    };
    
    // Kiểm tra mã phòng ban trong tên file (thường là 2-3 ký tự sau mã công ty)
    // Ví dụ: PDH-PC-xxx (Pháp chế), PDH-TC-xxx (Tài chính), PDH-KT-xxx (Kế toán)
    const deptCodeMatch = normalizedName.match(/pdh[-_]([a-z]{2,3})[-_]/i);
    if (deptCodeMatch) {
      const deptCode = deptCodeMatch[1].toLowerCase();
      if (deptCode === 'pc') return 'phap_che';
      if (deptCode === 'tc') return 'tai_chinh';
      if (deptCode === 'kt') return 'ke_toan';
      if (deptCode === 'ns') return 'nhan_su';
      if (deptCode === 'it' || deptCode === 'cn') return 'it';
      if (deptCode === 'sx') return 'san_xuat';
      if (deptCode === 'kd') return 'kinh_doanh';
    }
    
    // Kiểm tra tên phòng ban đầy đủ trong tên file
    for (const [deptKey, variants] of Object.entries(departments)) {
      for (const variant of variants) {
        if (normalizedName.includes(variant)) {
          return deptKey;
        }
      }
    }
    
    return null;
  }
  
  // Generate structure analysis from filename when OCR fails
  async generateStructureFromFilename(filename) {
    try {
      const filenameWithoutExtension = filename.replace(/\.[^/.]+$/, "");
      
      const prompt = `
Phân tích tên file này và tạo metadata cấu trúc văn bản giả định phù hợp:

FILENAME: ${filenameWithoutExtension}

Trả lời theo format JSON:
{
  "documentType": "Quy định|Quy trình|Báo cáo|Hợp đồng|Sơ đồ|Khác",
  "mainTopics": ["topic1", "topic2"],
  "keyPoints": [
    {
      "section": "Phần nào",
      "content": "Nội dung giả định phù hợp",
      "importance": 1-5
    }
  ],
  "procedures": [],
  "keyTerms": ["term1", "term2"],
  "canAnswerQuestions": [
    "Câu hỏi liên quan đến file này",
    "Nội dung gì được đề cập trong file này?"
  ]
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysisText = response.text().trim();
      
      // Extract JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        console.log(`📊 Generated structure from filename`);
        return analysis;
      }
      
      // Fallback structure
      return {
        documentType: this.detectDocumentTypeFromFilename(filename),
        mainTopics: [filenameWithoutExtension],
        keyPoints: [{
          section: "Toàn tài liệu",
          content: `Nội dung liên quan đến ${filenameWithoutExtension}`,
          importance: 3
        }],
        procedures: [],
        keyTerms: this.extractKeyTermsFromFilename(filename),
        canAnswerQuestions: this.generateDefaultQuestions(filename)
      };
      
    } catch (error) {
      console.error('❌ Error generating structure from filename:', error);
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
  
  // Extract key terms from filename
  extractKeyTermsFromFilename(filename) {
    const filenameWithoutExtension = filename.replace(/\.[^/.]+$/, "");
    const terms = [];
    
    // Extract company name if present
    if (filenameWithoutExtension.includes('PDH')) {
      terms.push('PDH', 'Phát Đạt');
    }
    
    // Extract common document types
    if (/so do|sơ đồ/i.test(filenameWithoutExtension)) {
      terms.push('Sơ đồ', 'Cơ cấu tổ chức');
    }
    
    if (/quy trinh|quy trình/i.test(filenameWithoutExtension)) {
      terms.push('Quy trình');
    }
    
    if (/quy dinh|quy định/i.test(filenameWithoutExtension)) {
      terms.push('Quy định');
    }
    
    // Extract department names
    if (/phap che|pháp chế/i.test(filenameWithoutExtension)) {
      terms.push('Ban Pháp chế', 'Pháp chế');
    }
    
    if (/tai chinh|tài chính/i.test(filenameWithoutExtension)) {
      terms.push('Ban Tài chính', 'Tài chính');
    }
    
    if (/ke toan|kế toán/i.test(filenameWithoutExtension)) {
      terms.push('Ban Kế toán', 'Kế toán');
    }
    
    if (/nhan su|nhân sự/i.test(filenameWithoutExtension)) {
      terms.push('Ban Nhân sự', 'Nhân sự');
    }
    
    // Add the filename itself as a term if not too long
    if (filenameWithoutExtension.length < 50) {
      terms.push(filenameWithoutExtension);
    }
    
    return [...new Set(terms)]; // Remove duplicates
  }
  
  // Detect document type from filename
  detectDocumentTypeFromFilename(filename) {
    const filenameLower = filename.toLowerCase();
    
    // Kiểm tra dạng file
    if (/so do|sơ đồ/i.test(filenameLower)) {
      return 'Sơ đồ';
    }
    
    if (/quy[ -]?trinh|quy[ -]?trình|trinh tu|trình tự/i.test(filenameLower)) {
      return 'Quy trình';
    }
    
    if (/quy[ -]?dinh|quy[ -]?định|dinh muc|định mức/i.test(filenameLower)) {
      return 'Quy định';
    }
    
    if (/bao cao|báo cáo/i.test(filenameLower)) {
      return 'Báo cáo';
    }
    
    if (/hop dong|hợp đồng|contract/i.test(filenameLower)) {
      return 'Hợp đồng';
    }
    
    // Phát hiện theo định dạng của tên file
    if (filenameLower.startsWith('quy-trinh') || filenameLower.includes('-qt-')) {
      return 'Quy trình';
    }
    
    if (filenameLower.startsWith('quy-dinh') || filenameLower.includes('-qd-')) {
      return 'Quy định';
    }
    
    // Phát hiện các từ khóa khác liên quan đến quy trình
    if (filenameLower.includes('vay-von') || 
        filenameLower.includes('vay von') || 
        filenameLower.includes('thu tuc') ||
        filenameLower.includes('thủ tục')) {
      return 'Quy trình';
    }
    
    return 'Khác';
  }
  
  // Generate default questions for a document based on filename
  generateDefaultQuestions(filename, category = null) {
    const questions = [];
    const filenameLower = filename.toLowerCase();
    const documentType = category || this.detectDocumentTypeFromFilename(filename);
    
    // Common questions for all document types
    questions.push(`Tài liệu "${filename}" có nội dung gì?`);
    questions.push(`Đây là loại tài liệu gì?`);
    
    // Questions specific to document type
    if (documentType === 'Sơ đồ') {
      questions.push(`Sơ đồ này mô tả cấu trúc nào?`);
      
      if (/phap che|pháp chế/i.test(filenameLower)) {
        questions.push(`Ban Pháp chế có những vị trí nào?`);
        questions.push(`Cơ cấu tổ chức của Ban Pháp chế như thế nào?`);
        questions.push(`Ai là trưởng Ban Pháp chế?`);
      }
      
      if (/tai chinh|tài chính/i.test(filenameLower)) {
        questions.push(`Ban Tài chính có những vị trí nào?`);
        questions.push(`Cơ cấu tổ chức của Ban Tài chính như thế nào?`);
        questions.push(`Ai là trưởng Ban Tài chính?`);
      }
    }
    
    if (documentType === 'Quy trình') {
      questions.push(`Quy trình này có những bước nào?`);
      questions.push(`Ai chịu trách nhiệm trong quy trình này?`);
    }
    
    if (documentType === 'Quy định') {
      questions.push(`Quy định này áp dụng cho đối tượng nào?`);
      questions.push(`Có những điều khoản quan trọng nào trong quy định này?`);
    }
    
    // Limit to 10 questions
    return questions.slice(0, 10);
  }

  // Cross-document validation and OCR correction - called after document is saved
  async performCrossDocumentValidation(documentId, text, filename, companyId) {
    try {
      // Kiểm tra kết nối database trước khi thực hiện
      if (!this.db || typeof this.db.query !== 'function') {
        console.error('❌ No valid database connection for cross-document validation');
        throw new Error('Database connection not available or invalid');
      }

      // Khởi tạo cross-document validation service nếu chưa có
      if (!this.crossDocValidator) {
        const CrossDocumentValidationService = require('../src/services/validation/crossDocumentValidationService');
        this.crossDocValidator = new CrossDocumentValidationService();
        // Pass the database connection to the validator
        if (this.db) {
          this.crossDocValidator.setDbConnection(this.db);
        }
      }
      
      // Kiểm tra lại kết nối database trong validator
      if (!this.crossDocValidator.db || typeof this.crossDocValidator.db.query !== 'function') {
        console.error('❌ Cross-document validator has no valid database connection');
        throw new Error('Cross-document validator database connection not available');
      }
      
      // Perform cross-document validation and correction
      const validationResult = await this.crossDocValidator.validateAndCorrectDocument(
        documentId, 
        text, 
        filename, 
        companyId
      );
      
      // Update document with corrected text if significant corrections were made
      if (validationResult.corrections && validationResult.corrections.length > 0 && 
          validationResult.confidence > 0.8 && 
          validationResult.correctedText !== validationResult.originalText) {
        
        console.log(`✅ Applying ${validationResult.corrections.length} corrections to document ${documentId}`);
        
        // Update document content with corrected text
        await this.db.updateDocument(documentId, {
          content_text: validationResult.correctedText,
          processing_notes: JSON.stringify({
            ocr_corrections: validationResult.corrections.length,
            entity_conflicts: validationResult.conflicts ? validationResult.conflicts.length : 0,
            validation_confidence: validationResult.confidence,
            processing_timestamp: new Date().toISOString()
          })
        });
        
        console.log(`📝 Updated document ${documentId} with corrected text and metadata`);
      }
      
      // Log validation results
      await this.logValidationResults(documentId, validationResult);
      
      return validationResult;
      
    } catch (error) {
      console.error('❌ Error in cross-document validation:', error);
      // Trả về lỗi rõ ràng để controller có thể xử lý
      return {
        originalText: text,
        correctedText: text,
        entities: {},
        corrections: [],
        conflicts: [],
        confidence: 0.5,
        error: error.message,
        errorType: 'validation_error',
        success: false
      };
    }
  }

  // Log validation results for debugging and auditing
  async logValidationResults(documentId, validationResult) {
    try {
      // Kiểm tra kết nối database
      if (!this.db || typeof this.db.query !== 'function') {
        console.error('❌ Cannot log validation results: No valid database connection');
        return;
      }

      // Create tables if they don't exist
      await this.ensureValidationTablesExist();
      
      await this.db.query(`
        INSERT INTO validation_logs (
          document_id, 
          validation_type, 
          original_text, 
          corrected_text, 
          entities_found, 
          corrections_applied, 
          conflicts_resolved, 
          confidence_score,
          processing_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        documentId,
        'cross_document_validation',
        validationResult.originalText ? validationResult.originalText.substring(0, 1000) : '',
        validationResult.correctedText ? validationResult.correctedText.substring(0, 1000) : '',
        JSON.stringify(validationResult.entities || {}),
        JSON.stringify(validationResult.corrections || []),
        JSON.stringify(validationResult.conflicts || []),
        validationResult.confidence || 0.0,
        0 // We'll add timing later if needed
      ]);
      
      console.log(`📊 Logged validation results for document ${documentId}`);
    } catch (error) {
      console.error('❌ Error logging validation results:', error);
    }
  }

  // Ensure validation tables exist (for first run)
  async ensureValidationTablesExist() {
    try {
      // Kiểm tra kết nối database
      if (!this.db || typeof this.db.query !== 'function') {
        console.error('❌ Cannot ensure validation tables: No valid database connection');
        return;
      }

      const checkTablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('document_metadata', 'company_metadata', 'validation_logs', 'entity_references')
      `;
      
      const result = await this.db.query(checkTablesQuery);
      
      if (!result.rows || result.rows.length < 4) {
        console.log('📦 Creating validation tables...');
        // Read and execute schema
        const schemaPath = path.join(__dirname, '../scripts/create-metadata-tables.sql');
        if (fs.existsSync(schemaPath)) {
          const schema = fs.readFileSync(schemaPath, 'utf8');
          await this.db.query(schema);
          console.log('✅ Validation tables created successfully');
        } else {
          console.log('⚠️ Schema file not found at:', schemaPath);
          // Create tables inline as fallback
          await this.createValidationTablesInline();
        }
      }
    } catch (error) {
      console.error('❌ Error ensuring validation tables exist:', error);
    }
  }
  
  // Create validation tables inline if SQL file is not found
  async createValidationTablesInline() {
    try {
      const createTablesSQL = `
        -- Document metadata table
        CREATE TABLE IF NOT EXISTS document_metadata (
          id SERIAL PRIMARY KEY,
          document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
          entities JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(document_id)
        );

        -- Company metadata table
        CREATE TABLE IF NOT EXISTS company_metadata (
          id SERIAL PRIMARY KEY,
          company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(company_id)
        );

        -- Validation logs table
        CREATE TABLE IF NOT EXISTS validation_logs (
          id SERIAL PRIMARY KEY,
          document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
          validation_type VARCHAR(100) NOT NULL,
          original_text TEXT,
          corrected_text TEXT,
          entities_found JSONB DEFAULT '{}',
          corrections_applied JSONB DEFAULT '[]',
          conflicts_resolved JSONB DEFAULT '[]',
          confidence_score DECIMAL(3,2) DEFAULT 0.0,
          processing_time_ms INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Entity references table for fast lookup
        CREATE TABLE IF NOT EXISTS entity_references (
          id SERIAL PRIMARY KEY,
          entity_name VARCHAR(255) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
          company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
          confidence DECIMAL(3,2) DEFAULT 1.0,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;
      
      // Split and execute each statement
      const statements = createTablesSQL.split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      for (const statement of statements) {
        await this.db.query(statement);
      }
      
      console.log('✅ Validation tables created successfully (inline SQL)');
    } catch (error) {
      console.error('❌ Error creating validation tables inline:', error);
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

  // Enhanced document processing (main function)
  async processDocumentWithEnhancements(pdfPath, filename, originalName, companyId = null) {
    try {
      console.log(`🚀 Processing document with enhancements: ${originalName}`);
      // Step 1: Extract text (use standard PDF extraction + OCR if needed)
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(dataBuffer);
      let extractedText = data.text;
      // Use OCR if standard extraction yields little text
      if (this.isScannedPDF(extractedText)) {
        console.log('📸 Using Vision API for scanned document...');
        // Convert PDF to images and extract text from each page
        const images = await this.convertPDFToImages(pdfPath);
        let ocrText = '';
        for (const img of images) {
          ocrText += await this.extractTextFromImage(img.path) + '\n';
        }
        extractedText = ocrText;
      }
      // Apply text correction
      extractedText = await this.correctOCRText(extractedText);
      // Step 2: Classify content
      const classification = await this.classifyDocumentContent(extractedText, originalName);
      if (!classification.accept) {
        throw new Error(`Document rejected: ${classification.reason}`);
      }
      // Step 3: Check for duplicates
      const duplicateAnalysis = await this.checkForDuplicates(extractedText, originalName, companyId);
      // Step 4: Handle duplicates if found
      if (duplicateAnalysis.isDuplicate && duplicateAnalysis.recommendation === 'merge') {
        console.log('🔗 Would merge with similar document...');
        const similarDoc = duplicateAnalysis.similarDocs[0];
        if (similarDoc) {
          const existingDoc = await this.db.getDocumentById(similarDoc.id);
          if (existingDoc) {
            extractedText = await this.mergeSimilarDocuments(
              extractedText,
              existingDoc,
              similarDoc.reason
            );
          }
        }
      }
      // Step 5: Analyze document structure
      const structureAnalysis = await this.generateStructureFromFilename(originalName);
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
}

module.exports = new VisionOCRService(); 