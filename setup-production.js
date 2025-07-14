const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up production environment...');

// Create necessary directories
const dirs = ['temp', 'temp-images', 'uploads'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Copy Tesseract language files to expected location if needed
const tessDataDir = process.env.TESSDATA_PREFIX || '/app';
const langFiles = ['eng.traineddata', 'vie.traineddata'];

langFiles.forEach(file => {
  const sourcePath = path.join(__dirname, file);
  const targetPath = path.join(tessDataDir, file);
  
  if (fs.existsSync(sourcePath)) {
    try {
      // Create target directory if it doesn't exist
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Copy file if target doesn't exist or is different
      if (!fs.existsSync(targetPath)) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✅ Copied ${file} to ${targetPath}`);
      } else {
        console.log(`ℹ️  ${file} already exists at ${targetPath}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not copy ${file}: ${error.message}`);
      // Not critical, system tesseract might have these files
    }
  } else {
    console.log(`⚠️  Source file not found: ${sourcePath}`);
  }
});

// Verify critical environment variables
const requiredEnvs = [
  'DATABASE_PUBLIC_URL',
  'GEMINI_API_KEY',
  'GCS_BUCKET_NAME',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON'
];

let allEnvsPresent = true;
requiredEnvs.forEach(env => {
  if (!process.env[env]) {
    console.error(`❌ Missing required environment variable: ${env}`);
    allEnvsPresent = false;
  } else {
    console.log(`✅ Environment variable present: ${env}`);
  }
});

if (allEnvsPresent) {
  console.log('🎉 Production environment setup completed successfully!');
} else {
  console.error('💥 Production setup failed - missing environment variables');
  process.exit(1);
}

// Test Google Cloud Storage credentials
try {
  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}');
  if (credentials.client_email && credentials.private_key) {
    console.log('✅ Google Cloud credentials format is valid');
  } else {
    console.error('❌ Invalid Google Cloud credentials format');
  }
} catch (error) {
  console.error('❌ Could not parse Google Cloud credentials:', error.message);
}

console.log('📋 Environment Summary:');
console.log(`   - Node.js: ${process.version}`);
console.log(`   - Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   - Port: ${process.env.PORT || 3000}`);
console.log(`   - GCS Bucket: ${process.env.GCS_BUCKET_NAME}`);
console.log(`   - Tesseract Data: ${tessDataDir}`);
console.log(''); 