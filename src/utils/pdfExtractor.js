const fs = require('fs');
const pdfParse = require('pdf-parse');
const ocrService = require('../../services/ocr-service');

// Enhanced utility function to extract text from PDF (including scanned PDFs)
async function extractTextFromPDF(filePath) {
  try {
    console.log('📄 Extracting text from PDF...');
    
    // First, try standard PDF text extraction
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    let extractedText = data.text;
    
    console.log(`📊 Standard extraction: ${extractedText.length} characters`);
    
    // Check if PDF is likely scanned (has very little meaningful text)
    if (ocrService.isScannedPDF(extractedText)) {
      console.log('🔍 Detected scanned PDF, using OCR...');
      
      try {
        // Use OCR for scanned PDFs
        const ocrText = await ocrService.processScannedPDF(filePath);
        
        if (ocrText && ocrText.trim().length > extractedText.trim().length) {
          extractedText = ocrText;
          console.log(`✅ OCR successful: ${extractedText.length} characters`);
        } else {
          console.log('⚠️ OCR did not improve text extraction');
        }
      } catch (ocrError) {
        console.error('❌ OCR failed:', ocrError.message);
        // Continue with standard extraction even if OCR fails
      }
    }
    
    return extractedText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

module.exports = { extractTextFromPDF }; 