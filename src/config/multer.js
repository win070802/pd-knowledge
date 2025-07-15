const multer = require('multer');
const path = require('path');

// Parse file size from string (e.g., "150mb" -> 157286400 bytes)
function parseFileSize(sizeStr) {
  if (!sizeStr) return 100 * 1024 * 1024; // Default 100MB
  
  const size = sizeStr.toString().toLowerCase();
  const num = parseFloat(size);
  
  if (size.includes('gb')) {
    return num * 1024 * 1024 * 1024;
  } else if (size.includes('mb')) {
    return num * 1024 * 1024;
  } else if (size.includes('kb')) {
    return num * 1024;
  } else {
    return parseInt(size) || 100 * 1024 * 1024; // Default 100MB if parsing fails
  }
}

const maxFileSize = parseFileSize(process.env.MAX_FILE_SIZE);
console.log(`📁 Multer file size limit: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './temp'); // Use temp directory for uploads
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'document-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: maxFileSize,
    files: 1,
    fieldSize: maxFileSize // Match field size to file size
  },
  fileFilter: (req, file, cb) => {
    console.log(`📁 Uploading file: ${file.originalname} (${file.mimetype}, ${(file.size || 0 / 1024 / 1024).toFixed(1)}MB)`);
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

module.exports = { upload }; 