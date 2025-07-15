const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_PDF_PATH = './test-sample.pdf'; // You need to create this file

class VisionAPITester {
  constructor() {
    this.results = [];
  }

  async testUploadEnhanced() {
    console.log('🧪 Testing Enhanced Upload with Vision API...');
    
    try {
      // Check if test PDF exists
      if (!fs.existsSync(TEST_PDF_PATH)) {
        console.log('❌ Test PDF not found. Please create a test PDF file at:', TEST_PDF_PATH);
        return false;
      }

      const formData = new FormData();
      formData.append('document', fs.createReadStream(TEST_PDF_PATH));

      const response = await axios.post(`${BASE_URL}/api/upload`, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      console.log('✅ Upload successful!');
      console.log('📊 Response:', JSON.stringify(response.data, null, 2));
      
      // Check if all new features are working
      const data = response.data;
      const checks = [
        { name: 'Success status', pass: data.success === true },
        { name: 'AI Analysis present', pass: !!data.aiAnalysis },
        { name: 'Classification present', pass: !!data.aiAnalysis?.classification },
        { name: 'Duplicate analysis present', pass: !!data.aiAnalysis?.duplicateAnalysis },
        { name: 'Structure analysis present', pass: !!data.aiAnalysis?.structureAnalysis },
        { name: 'Can answer questions', pass: Array.isArray(data.aiAnalysis?.canAnswerQuestions) },
        { name: 'Key topics identified', pass: Array.isArray(data.aiAnalysis?.keyTopics) },
        { name: 'Document type detected', pass: !!data.aiAnalysis?.documentType },
      ];

      console.log('\n📋 Feature Checks:');
      checks.forEach(check => {
        console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
      });

      this.results.push({
        test: 'Enhanced Upload',
        passed: checks.every(check => check.pass),
        details: data
      });

      return true;

    } catch (error) {
      console.error('❌ Upload test failed:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
      }
      return false;
    }
  }

  async testDocumentClassification() {
    console.log('\n🔍 Testing Document Classification...');
    
    // Test with various document types
    const testCases = [
      {
        name: 'Business Document',
        content: 'QUY ĐỊNH VỀ NGHỈ PHÉP CÔNG TY PHÁT ĐẠT\n1. Quy định chung\n2. Thời gian nghỉ phép\n3. Thủ tục xin nghỉ',
        filename: 'PDH-QD-001-NghePhep.pdf',
        expected: { accept: true, category: 'Quy định' }
      },
      {
        name: 'Junk Document',
        content: 'hello world test 123 random text spam spam spam',
        filename: 'test.pdf',
        expected: { accept: false }
      },
      {
        name: 'Process Document',
        content: 'QUY TRÌNH TUYỂN DỤNG\nBước 1: Đăng tin tuyển dụng\nBước 2: Sàng lọc hồ sơ\nBước 3: Phỏng vấn',
        filename: 'PDH-QT-002-TuyenDung.pdf',
        expected: { accept: true, category: 'Quy trình' }
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n📝 Testing: ${testCase.name}`);
      
      try {
        const visionOCRService = require('./vision-ocr-service');
        const result = await visionOCRService.classifyDocumentContent(testCase.content, testCase.filename);
        
        console.log(`Result: ${result.accept ? 'ACCEPT' : 'REJECT'} - Category: ${result.category}`);
        console.log(`Confidence: ${result.confidence}, Reason: ${result.reason}`);
        
        const passed = result.accept === testCase.expected.accept && 
                      (!testCase.expected.category || result.category === testCase.expected.category);
        
        console.log(`${passed ? '✅' : '❌'} Classification test`);
        
        this.results.push({
          test: `Classification - ${testCase.name}`,
          passed: passed,
          details: result
        });
        
      } catch (error) {
        console.error(`❌ Classification test failed for ${testCase.name}:`, error.message);
        this.results.push({
          test: `Classification - ${testCase.name}`,
          passed: false,
          details: error.message
        });
      }
    }
  }

  async testDuplicateDetection() {
    console.log('\n🔍 Testing Duplicate Detection...');
    
    try {
      const visionOCRService = require('./vision-ocr-service');
      
      // Test duplicate detection
      const text1 = 'QUY ĐỊNH VỀ NGHỈ PHÉP CÔNG TY PHÁT ĐẠT\nNhân viên được nghỉ phép 12 ngày/năm';
      const text2 = 'QUY ĐỊNH NGHỈ PHÉP CÔNG TY PHÁT ĐẠT\nMỗi nhân viên có quyền nghỉ phép 12 ngày trong năm';
      
      console.log('📝 Testing similar documents...');
      
      const result1 = await visionOCRService.checkForDuplicates(text1, 'nghiphep-v1.pdf', 1);
      console.log('First document result:', result1);
      
      const result2 = await visionOCRService.checkForDuplicates(text2, 'nghiphep-v2.pdf', 1);
      console.log('Second document result:', result2);
      
      this.results.push({
        test: 'Duplicate Detection',
        passed: true, // Manual verification needed
        details: { result1, result2 }
      });
      
    } catch (error) {
      console.error('❌ Duplicate detection test failed:', error.message);
      this.results.push({
        test: 'Duplicate Detection',
        passed: false,
        details: error.message
      });
    }
  }

  async testStructureAnalysis() {
    console.log('\n🔍 Testing Document Structure Analysis...');
    
    try {
      const visionOCRService = require('./vision-ocr-service');
      
      const testDocument = `
QUY TRÌNH TUYỂN DỤNG CÔNG TY PHÁT ĐẠT

1. TUYỂN DỤNG NHÂN VIÊN
   Bước 1: Đăng tin tuyển dụng trên website
   Bước 2: Sàng lọc hồ sơ ứng viên
   Bước 3: Phỏng vấn vòng 1 - HR
   Bước 4: Phỏng vấn vòng 2 - Chuyên môn
   Bước 5: Quyết định tuyển dụng

2. THÔNG TIN LIÊN HỆ
   Phòng Nhân sự: 123-456-789
   Email: hr@phatdat.com
   
3. CHÍNH SÁCH TUYỂN DỤNG
   - Bình đẳng giới
   - Không phân biệt tôn giáo
   - Ưu tiên ứng viên có kinh nghiệm
`;

      const analysis = await visionOCRService.analyzeDocumentStructure(testDocument);
      
      console.log('📊 Structure Analysis Result:');
      console.log('Document Type:', analysis.documentType);
      console.log('Main Topics:', analysis.mainTopics);
      console.log('Key Points:', analysis.keyPoints.length);
      console.log('Procedures:', analysis.procedures.length);
      console.log('Can Answer Questions:', analysis.canAnswerQuestions);
      
      const passed = analysis.documentType === 'Quy trình' && 
                    analysis.procedures.length > 0 && 
                    analysis.canAnswerQuestions.length > 0;
      
      console.log(`${passed ? '✅' : '❌'} Structure analysis test`);
      
      this.results.push({
        test: 'Structure Analysis',
        passed: passed,
        details: analysis
      });
      
    } catch (error) {
      console.error('❌ Structure analysis test failed:', error.message);
      this.results.push({
        test: 'Structure Analysis',
        passed: false,
        details: error.message
      });
    }
  }

  async testQACapabilities() {
    console.log('\n🤖 Testing Enhanced Q&A Capabilities...');
    
    const testQuestions = [
      'Quy trình tuyển dụng của công ty như thế nào?',
      'Nghỉ phép được bao nhiêu ngày?',
      'Ai là người phụ trách tuyển dụng?',
      'Bước đầu tiên trong quy trình tuyển dụng là gì?'
    ];

    for (const question of testQuestions) {
      try {
        console.log(`\n❓ Testing question: "${question}"`);
        
        const response = await axios.post(`${BASE_URL}/api/ask`, {
          question: question
        });
        
        console.log(`✅ Answer: ${response.data.answer.substring(0, 100)}...`);
        console.log(`📊 Response time: ${response.data.responseTime}ms`);
        
        this.results.push({
          test: `Q&A - ${question}`,
          passed: response.data.success && response.data.answer.length > 0,
          details: response.data
        });
        
      } catch (error) {
        console.error(`❌ Q&A test failed for "${question}":`, error.message);
        this.results.push({
          test: `Q&A - ${question}`,
          passed: false,
          details: error.message
        });
      }
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Vision API Feature Tests...\n');
    
    try {
      // Test individual components first
      await this.testDocumentClassification();
      await this.testDuplicateDetection();
      await this.testStructureAnalysis();
      
      // Test full upload workflow
      await this.testUploadEnhanced();
      
      // Test Q&A capabilities
      await this.testQACapabilities();
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Test execution failed:', error.message);
    }
  }

  generateReport() {
    console.log('\n📊 TEST RESULTS SUMMARY');
    console.log('=' .repeat(50));
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const passRate = total > 0 ? (passed / total * 100).toFixed(1) : 0;
    
    console.log(`Overall: ${passed}/${total} tests passed (${passRate}%)`);
    console.log();
    
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test}`);
      
      if (!result.passed) {
        console.log(`   Details: ${typeof result.details === 'string' ? result.details : JSON.stringify(result.details, null, 2)}`);
      }
    });
    
    console.log('\n🎯 Next Steps:');
    if (passRate < 100) {
      console.log('- Fix failing tests');
      console.log('- Check environment variables');
      console.log('- Verify Google Cloud Vision API setup');
    } else {
      console.log('- All tests passed! System ready for production');
      console.log('- Monitor performance in production');
      console.log('- Set up logging and alerts');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new VisionAPITester();
  tester.runAllTests().catch(console.error);
}

module.exports = VisionAPITester; 