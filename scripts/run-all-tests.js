const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config();

// Danh sách các script test cần chạy
const testScripts = [
  'test-ocr.js',
  'test-department-detection.js',
  'test-document-classification.js'
];

// Thư mục lưu báo cáo kết quả
const reportDir = './testFolder/test-reports';
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

// Kiểm tra nếu có thư mục kết quả khác
const resultDirs = [
  './testFolder/ocr-results',
  './testFolder/department-results',
  './testFolder/classification-results'
];

resultDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Chạy các script test lần lượt
async function runAllTests() {
  console.log('🚀 Bắt đầu chạy tất cả các bài test OCR...\n');
  
  // Tạo file báo cáo
  const reportFile = path.join(reportDir, `ocr-test-report-${new Date().toISOString().replace(/:/g, '-')}.log`);
  
  // Ghi thông tin môi trường
  let report = `=== BÁO CÁO KIỂM THỬ OCR ===\n`;
  report += `Thời gian: ${new Date().toLocaleString()}\n`;
  report += `Node version: ${process.version}\n`;
  report += `Platform: ${process.platform}\n\n`;
  
  fs.writeFileSync(reportFile, report);
  
  // Chạy từng script test
  for (const script of testScripts) {
    console.log(`\n📋 Đang chạy test: ${script}...\n`);
    
    // Chạy script và đợi kết quả
    await new Promise((resolve, reject) => {
      // Tạo stream để ghi log ra cả console và file
      const logFile = fs.createWriteStream(reportFile, { flags: 'a' });
      
      // Chạy script test
      const child = exec(`node ./scripts/${script}`, {
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer cho output
      });
      
      // Ghi output ra console và file
      child.stdout.on('data', (data) => {
        process.stdout.write(data);
        logFile.write(data);
      });
      
      child.stderr.on('data', (data) => {
        process.stderr.write(data);
        logFile.write(`[ERROR] ${data}`);
      });
      
      child.on('close', (code) => {
        const result = `\n=== Kết quả test ${script}: ${code === 0 ? 'THÀNH CÔNG' : 'THẤT BẠI'} (exit code ${code}) ===\n\n`;
        fs.appendFileSync(reportFile, result);
        console.log(result);
        resolve();
      });
      
      child.on('error', (error) => {
        const errorMsg = `\n[ERROR] Lỗi khi chạy ${script}: ${error.message}\n`;
        fs.appendFileSync(reportFile, errorMsg);
        console.error(errorMsg);
        reject(error);
      });
    }).catch(error => {
      console.error(`Lỗi khi chạy ${script}:`, error);
    });
    
    // Đợi 1 giây giữa các test để tránh xung đột tài nguyên
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Kết hợp tất cả kết quả thành một báo cáo tổng hợp
  console.log('\n📊 Đang tạo báo cáo tổng hợp...');
  
  try {
    // Kết hợp các kết quả từ các thư mục
    const summaryFile = path.join(reportDir, 'ocr-test-summary.json');
    const summary = {
      testTime: new Date().toISOString(),
      ocr: {
        filesProcessed: 0,
        results: []
      },
      departmentDetection: {
        filesAnalyzed: 0,
        results: null
      },
      classification: {
        filesClassified: 0,
        results: null
      }
    };
    
    // Đọc kết quả OCR
    const ocrDir = './testFolder/ocr-results';
    if (fs.existsSync(ocrDir)) {
      const ocrFiles = fs.readdirSync(ocrDir);
      summary.ocr.filesProcessed = ocrFiles.filter(f => f.endsWith('_OCR_Results.txt')).length;
      summary.ocr.results = ocrFiles;
    }
    
    // Đọc kết quả phát hiện phòng ban
    const deptFile = './testFolder/department-results/department_detection_results.json';
    if (fs.existsSync(deptFile)) {
      const deptData = JSON.parse(fs.readFileSync(deptFile, 'utf8'));
      summary.departmentDetection.filesAnalyzed = deptData.length;
      summary.departmentDetection.results = deptData;
    }
    
    // Đọc kết quả phân loại
    const classFile = './testFolder/classification-results/document_classification_results.json';
    if (fs.existsSync(classFile)) {
      const classData = JSON.parse(fs.readFileSync(classFile, 'utf8'));
      summary.classification.filesClassified = classData.length;
      summary.classification.results = classData;
    }
    
    // Lưu báo cáo tổng hợp
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`✅ Đã lưu báo cáo tổng hợp vào: ${summaryFile}`);
    
    // Tạo báo cáo cuối cùng
    const finalReport = `
=== BÁO CÁO TỔNG HỢP KIỂM THỬ OCR ===

Thời gian: ${new Date().toLocaleString()}
Số file PDF đã xử lý: ${summary.ocr.filesProcessed}
Số file đã phân tích phòng ban: ${summary.departmentDetection.filesAnalyzed}
Số file đã phân loại: ${summary.classification.filesClassified}

Chi tiết báo cáo đã được lưu vào: ${summaryFile}
File log đầy đủ: ${reportFile}

Kết quả OCR: ${ocrDir}
Kết quả phát hiện phòng ban: ${deptFile}
Kết quả phân loại: ${classFile}
    `;
    
    fs.appendFileSync(reportFile, finalReport);
    console.log(finalReport);
    
  } catch (error) {
    console.error('Lỗi khi tạo báo cáo tổng hợp:', error);
  }
  
  console.log('\n✅ Đã hoàn thành tất cả các bài test OCR!');
}

// Thực thi
runAllTests().catch(console.error); 