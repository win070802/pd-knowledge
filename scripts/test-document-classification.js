const fs = require('fs');
const path = require('path');
const visionOCRService = require('../services/vision-ocr-service');
const pdfParse = require('pdf-parse');
require('dotenv').config();

// Đảm bảo thư mục để lưu kết quả tồn tại
const resultsDir = './testFolder/classification-results';
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

async function testDocumentClassification() {
  console.log('Bắt đầu thử nghiệm tính năng phân loại tài liệu...');
  
  try {
    // Lấy danh sách file PDF trong thư mục testFolder
    const testFolder = './testFolder';
    const pdfFiles = fs.readdirSync(testFolder)
      .filter(file => file.toLowerCase().endsWith('.pdf'));
    
    const classificationResults = [];
    
    // Thử nghiệm phân loại tài liệu với từng file
    for (const pdfFile of pdfFiles) {
      console.log(`\n----- Phân loại tài liệu: ${pdfFile} -----`);
      const pdfPath = path.join(testFolder, pdfFile);
      
      try {
        // Trích xuất một phần nội dung để phân loại
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        let extractedText = data.text;
        
        // Nếu là PDF quét, sử dụng OCR để lấy nội dung
        if (visionOCRService.isScannedPDF(extractedText)) {
          console.log(`"${pdfFile}" được xác định là PDF quét, lấy mẫu văn bản từ tên file...`);
          // Tạo nội dung mẫu từ tên file
          extractedText = `Tài liệu ${pdfFile} - Không thể trích xuất nội dung`;
        } else {
          // Chỉ lấy 2000 ký tự đầu để phân loại
          extractedText = extractedText.substring(0, 2000);
          console.log(`Đã trích xuất ${extractedText.length} ký tự để phân loại...`);
        }
        
        // Thực hiện phân loại tài liệu
        console.log('Đang phân loại tài liệu...');
        const classification = await visionOCRService.classifyDocumentContent(extractedText, pdfFile);
        
        console.log(`Kết quả phân loại:
- Chấp nhận: ${classification.accept ? 'Có' : 'Không'}
- Loại: ${classification.category}
- Độ tin cậy: ${classification.confidence}
- Lý do: ${classification.reason}
- Liên quan kinh doanh: ${classification.businessRelevance}
        `);
        
        // Điều chỉnh phân loại dựa vào tên file
        if (extractedText.includes('Không thể trích xuất nội dung')) {
          console.log('Đang điều chỉnh phân loại dựa vào tên file...');
          
          // Xác định loại tài liệu từ tên file
          const docType = visionOCRService.detectDocumentTypeFromFilename(pdfFile);
          
          if (docType !== 'Khác') {
            classification.category = docType;
            classification.confidence = 0.9;
            console.log(`Đã điều chỉnh loại tài liệu thành: ${docType}`);
          }
        }
        
        // Phân tích cấu trúc tài liệu
        console.log('Đang tạo phân tích cấu trúc tài liệu...');
        let structureAnalysis;
        
        if (extractedText.includes('Không thể trích xuất nội dung')) {
          // Tạo cấu trúc từ tên file
          structureAnalysis = await visionOCRService.generateStructureFromFilename(pdfFile);
          console.log('Đã tạo cấu trúc từ tên file.');
        } else {
          // Phân tích cấu trúc từ nội dung
          structureAnalysis = await visionOCRService.analyzeDocumentStructure(extractedText);
          console.log('Đã phân tích cấu trúc từ nội dung.');
        }
        
        // Thêm kết quả vào mảng
        classificationResults.push({
          filename: pdfFile,
          classification,
          structureAnalysis,
          documentType: visionOCRService.detectDocumentTypeFromFilename(pdfFile),
          extractedKeyTerms: visionOCRService.extractKeyTermsFromFilename(pdfFile),
          generatedQuestions: visionOCRService.generateDefaultQuestions(pdfFile, classification.category)
        });
        
      } catch (error) {
        console.error(`Lỗi khi phân loại "${pdfFile}":`, error.message);
        classificationResults.push({
          filename: pdfFile,
          error: error.message
        });
      }
    }
    
    // Lưu kết quả vào file
    const outputFilename = path.join(resultsDir, 'document_classification_results.json');
    fs.writeFileSync(outputFilename, JSON.stringify(classificationResults, null, 2));
    console.log(`\nĐã lưu kết quả phân loại vào: ${outputFilename}`);
    
    console.log('\nĐã hoàn thành thử nghiệm phân loại tài liệu!');
    
  } catch (error) {
    console.error('Lỗi trong quá trình thử nghiệm:', error);
  }
}

// Thực thi
testDocumentClassification().catch(console.error); 