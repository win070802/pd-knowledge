#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Đường dẫn đến các file test
const testFiles = [
  '../test/api-test-qa.js',
  '../test/integration-test.js',
  '../test/data-integration-test.js',
  '../test/document-search-test.js'
];

// Đảm bảo thư mục test tồn tại
const testDir = path.join(__dirname, '../test');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Hàm chạy test
async function runTest(testFile) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, testFile);
    
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ Test file not found: ${fullPath}`);
      return resolve(false);
    }
    
    console.log(`\n🧪 Running test: ${path.basename(testFile)}`);
    console.log('----------------------------------------');
    
    const mocha = spawn('npx', ['mocha', fullPath], {
      stdio: 'inherit',
      shell: true
    });
    
    mocha.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ Test passed: ${path.basename(testFile)}`);
        resolve(true);
      } else {
        console.error(`\n❌ Test failed: ${path.basename(testFile)}`);
        resolve(false);
      }
    });
    
    mocha.on('error', (err) => {
      console.error(`\n❌ Error running test: ${err.message}`);
      resolve(false);
    });
  });
}

// Chạy tất cả các test
async function runAllTests() {
  console.log('🚀 Starting tests...');
  
  let allPassed = true;
  
  for (const testFile of testFiles) {
    const passed = await runTest(testFile);
    if (!passed) {
      allPassed = false;
    }
  }
  
  console.log('\n----------------------------------------');
  if (allPassed) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed!');
    process.exit(1);
  }
}

// Chạy tests
runAllTests().catch(err => {
  console.error('❌ Error running tests:', err);
  process.exit(1);
}); 