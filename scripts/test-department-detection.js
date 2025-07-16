const fs = require('fs');
const path = require('path');
const visionOCRService = require('../services/vision-ocr-service');
require('dotenv').config();

// Đảm bảo thư mục để lưu kết quả tồn tại
const resultsDir = './testFolder/department-results';
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

async function testDepartmentDetection() {
  console.log('Bắt đầu thử nghiệm tính năng phát hiện phòng ban...');
  
  try {
    // Lấy danh sách file PDF trong thư mục testFolder
    const testFolder = './testFolder';
    const pdfFiles = fs.readdirSync(testFolder)
      .filter(file => file.toLowerCase().endsWith('.pdf'));
    
    // Tạo một mảng để lưu kết quả
    const results = [];
    
    // Thử nghiệm với từng file
    for (const pdfFile of pdfFiles) {
      console.log(`\n----- Đang kiểm tra tên file: ${pdfFile} -----`);
      
      // Phát hiện phòng ban từ tên file
      const detectedDept = visionOCRService.extractDepartment(pdfFile);
      console.log(`Phát hiện phòng ban: ${detectedDept || 'Không xác định'}`);
      
      // Thử với các tên file khác để kiểm tra tính năng phát hiện xung đột phòng ban
      const testAgainstFiles = pdfFiles.filter(f => f !== pdfFile);
      const compatibilityResults = [];
      
      for (const otherFile of testAgainstFiles) {
        const areDifferentDepts = visionOCRService.filesReferToDifferentEntities(pdfFile, otherFile);
        compatibilityResults.push({
          otherFile,
          areDifferentDepts,
          detectedDept: visionOCRService.extractDepartment(otherFile)
        });
        
        console.log(`- So sánh với "${otherFile}": ${areDifferentDepts ? 'Khác phòng ban' : 'Cùng phòng ban hoặc không xác định'}`);
      }
      
      // Thử phát hiện loại tài liệu từ tên file
      const docType = visionOCRService.detectDocumentTypeFromFilename(pdfFile);
      console.log(`Loại tài liệu: ${docType}`);
      
      // Thử trích xuất từ khóa từ tên file
      const keyTerms = visionOCRService.extractKeyTermsFromFilename(pdfFile);
      console.log(`Từ khóa: ${keyTerms.join(', ')}`);
      
      // Thử tạo câu hỏi mặc định
      const questions = visionOCRService.generateDefaultQuestions(pdfFile, docType);
      console.log(`Số lượng câu hỏi được tạo: ${questions.length}`);
      
      // Lưu kết quả vào mảng
      results.push({
        filename: pdfFile,
        detectedDepartment: detectedDept,
        documentType: docType,
        keyTerms,
        questions,
        compatibility: compatibilityResults
      });
    }
    
    // Lưu kết quả vào file JSON
    const outputFilename = path.join(resultsDir, 'department_detection_results.json');
    fs.writeFileSync(outputFilename, JSON.stringify(results, null, 2));
    console.log(`\nĐã lưu tất cả kết quả vào: ${outputFilename}`);
    
    // Thử nghiệm tính năng phát hiện trùng lặp
    console.log('\nThử nghiệm tính năng phát hiện trùng lặp tài liệu...');
    
    // Giả lập một số nội dung tài liệu
    const sampleContent = {
      'phap_che': 'Quy trình làm việc của Ban Pháp chế công ty Phát Đạt. Bao gồm các bước thực hiện và quy định áp dụng.',
      'tai_chinh': 'Quy định quản lý tài chính của Ban Tài chính công ty Phát Đạt. Bao gồm các quy định về thanh toán và kiểm soát.',
      'it': 'Chính sách an toàn bảo mật thông tin của phòng CNTT công ty Phát Đạt. Bao gồm các quy định và hướng dẫn bảo mật.'
    };
    
    // Thử nghiệm phát hiện trùng lặp
    for (let i = 0; i < pdfFiles.length; i++) {
      const file1 = pdfFiles[i];
      const dept1 = visionOCRService.extractDepartment(file1) || 'unknown';
      const content1 = sampleContent[dept1] || 'Nội dung tài liệu không xác định';
      
      // So sánh với các file còn lại
      for (let j = i + 1; j < pdfFiles.length; j++) {
        const file2 = pdfFiles[j];
        const dept2 = visionOCRService.extractDepartment(file2) || 'unknown';
        const content2 = sampleContent[dept2] || 'Nội dung tài liệu không xác định';
        
        console.log(`\nSo sánh trùng lặp: "${file1}" vs "${file2}"`);
        console.log(`- Phòng ban 1: ${dept1}, Phòng ban 2: ${dept2}`);
        
        // Kiểm tra nếu thuộc phòng ban khác nhau
        const areDifferentDepts = visionOCRService.filesReferToDifferentEntities(file1, file2);
        console.log(`- Thuộc phòng ban khác nhau: ${areDifferentDepts}`);
        
        // Nếu khác phòng ban, không nên merge
        if (areDifferentDepts) {
          console.log('=> Không nên merge do khác phòng ban');
        } else {
          // Kiểm tra độ tương đồng nội dung
          const similarity = (dept1 === dept2) ? 'Cao' : 'Thấp';
          console.log(`- Độ tương đồng nội dung: ${similarity}`);
          console.log(`=> ${similarity === 'Cao' ? 'Có thể xem xét merge' : 'Không nên merge do nội dung khác nhau'}`);
        }
      }
    }
    
    console.log('\nĐã hoàn thành thử nghiệm phát hiện phòng ban!');
    
  } catch (error) {
    console.error('Lỗi trong quá trình thử nghiệm:', error);
  }
}

// Thực thi
testDepartmentDetection().catch(console.error); 