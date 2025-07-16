const fs = require('fs');
const path = require('path');
const visionOCRService = require('../services/vision-ocr-service');
require('dotenv').config();

// Đảm bảo thư mục để lưu kết quả tồn tại
const resultsDir = './testFolder/ocr-results';
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

async function testOCRFeature() {
  console.log('Bắt đầu thử nghiệm tính năng OCR...');
  
  try {
    // Lấy danh sách file PDF trong thư mục testFolder
    const testFolder = './testFolder';
    const pdfFiles = fs.readdirSync(testFolder)
      .filter(file => file.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('Không tìm thấy file PDF nào trong thư mục testFolder');
      return;
    }
    
    console.log(`Tìm thấy ${pdfFiles.length} file PDF để test OCR:`);
    pdfFiles.forEach((file, index) => console.log(`${index + 1}. ${file}`));
    
    // Thử nghiệm OCR với từng file
    for (const pdfFile of pdfFiles) {
      console.log(`\n----- Đang xử lý: ${pdfFile} -----`);
      const pdfPath = path.join(testFolder, pdfFile);
      
      // Kiểm tra xem có phải PDF quét không
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(pdfPath);
      const data = await pdfParse(dataBuffer);
      
      let extractedText;
      console.log(`Đang kiểm tra xem "${pdfFile}" có phải PDF quét không...`);
      
      if (visionOCRService.isScannedPDF(data.text)) {
        console.log(`"${pdfFile}" được xác định là PDF quét, sử dụng Vision API để OCR...`);
        extractedText = await visionOCRService.processScannedPDF(pdfPath);
      } else {
        console.log(`"${pdfFile}" là PDF thông thường, sử dụng trích xuất text tiêu chuẩn...`);
        extractedText = data.text;
      }
      
      // Lưu kết quả
      const outputFilename = path.join(resultsDir, `${pdfFile.replace('.pdf', '')}_OCR_Results.txt`);
      fs.writeFileSync(outputFilename, extractedText);
      console.log(`Đã lưu kết quả OCR vào: ${outputFilename}`);
      
      // Thử tính năng sửa lỗi OCR
      console.log(`Đang áp dụng AI để sửa lỗi OCR...`);
      const correctedText = await visionOCRService.correctOCRText(extractedText);
      
      // Lưu kết quả đã sửa
      const correctedFilename = path.join(resultsDir, `${pdfFile.replace('.pdf', '')}_OCR_Corrected.txt`);
      fs.writeFileSync(correctedFilename, correctedText);
      console.log(`Đã lưu kết quả OCR đã sửa vào: ${correctedFilename}`);
      
      // Phân tích cấu trúc tài liệu
      console.log(`Đang phân tích cấu trúc tài liệu...`);
      const structureAnalysis = await visionOCRService.analyzeDocumentStructure(correctedText);
      
      // Lưu kết quả phân tích
      const analysisFilename = path.join(resultsDir, `${pdfFile.replace('.pdf', '')}_Analysis.json`);
      fs.writeFileSync(analysisFilename, JSON.stringify(structureAnalysis, null, 2));
      console.log(`Đã lưu kết quả phân tích vào: ${analysisFilename}`);
    }
    
    console.log('\nĐã hoàn thành thử nghiệm OCR!');
    
  } catch (error) {
    console.error('Lỗi trong quá trình thử nghiệm OCR:', error);
  } finally {
    // Dọn dẹp tài nguyên
    visionOCRService.cleanup();
  }
}

// Thực thi
testOCRFeature().catch(console.error); 