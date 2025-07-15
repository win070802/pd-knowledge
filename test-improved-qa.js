#!/usr/bin/env node

const geminiService = require('./services/gemini');
const { initializeDatabase } = require('./database');

async function testImprovedQA() {
  console.log('🧪 Testing Improved Q&A System');
  console.log('='.repeat(50));
  
  try {
    // Initialize database
    await initializeDatabase();
    
    // Test cases
    const testCases = [
      {
        question: "Danh sách các công ty trong tập đoàn",
        expectedIntent: "list_companies",
        description: "Company listing question"
      },
      {
        question: "Có những công ty nào?",
        expectedIntent: "list_companies", 
        description: "Alternative company listing question"
      },
      {
        question: "Danh sách tất cả tài liệu trong tập đoàn",
        expectedIntent: "list_documents",
        description: "All documents listing question"
      },
      {
        question: "Danh sách tài liệu PDH",
        expectedIntent: "list_documents",
        description: "Single company documents"
      },
      {
        question: "Tóm tắt quy trình quản lý thanh toán", 
        expectedIntent: "hybrid_search",
        description: "Hybrid search question"
      },
      {
        question: "Team IT có mấy người?",
        expectedIntent: "find_knowledge",
        description: "Knowledge-based question"
      }
    ];
    
    console.log('\n🧠 Testing AI Intent Analysis:');
    console.log('-'.repeat(50));
    
    for (const testCase of testCases) {
      console.log(`\n📝 Testing: "${testCase.question}"`);
      console.log(`   Expected: ${testCase.expectedIntent}`);
      
      try {
        // Test intent analysis
        const intent = await geminiService.analyzeQuestionIntent(testCase.question);
        console.log(`   Actual: ${intent.intent} (confidence: ${intent.confidence})`);
        
        const match = intent.intent === testCase.expectedIntent;
        console.log(`   Result: ${match ? '✅ PASS' : '❌ FAIL'}`);
        
        if (!match) {
          console.log(`   🔍 Full intent:`, intent);
        }
        
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
      }
    }
    
    console.log('\n🎯 Testing Full Q&A Flow:');
    console.log('-'.repeat(50));
    
    // Test specific questions that should work now
    const fullTestCases = [
      "Danh sách các công ty trong tập đoàn",
      "Các công ty trong tập đoàn", 
      "Có những công ty nào?",
      "PDH là gì?",
      "PDI là gì?",
      "PDE là gì?"
    ];
    
    for (const question of fullTestCases) {
      console.log(`\n📝 Question: "${question}"`);
      
      try {
        const result = await geminiService.askQuestion(question);
        console.log(`   ✅ Response length: ${result.answer.length} characters`);
        console.log(`   📊 Response time: ${result.responseTime}ms`);
        console.log(`   📄 Relevant docs: ${result.relevantDocuments.length}`);
        
        // Show first 150 characters of answer
        const preview = result.answer.substring(0, 150).replace(/\n/g, ' ');
        console.log(`   📋 Preview: ${preview}...`);
        
      } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
      }
    }
    
    console.log('\n✅ Testing completed!');
    console.log('\n📋 Summary:');
    console.log('   🏢 Company listing questions should now work correctly');
    console.log('   📄 Document listing supports ALL companies');
    console.log('   🧠 AI intent analysis improved with new patterns');
    console.log('   ⚡ Constraints provide fast answers for common questions');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close any database connections
    process.exit(0);
  }
}

// Run tests
if (require.main === module) {
  testImprovedQA();
}

module.exports = { testImprovedQA }; 