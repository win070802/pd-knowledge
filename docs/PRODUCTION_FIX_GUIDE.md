# Production Fix Guide - PDF Upload Issues

## Overview
This guide addresses the production issue where PDF uploads fail with "No images extracted from PDF" error due to Vision API configuration problems.

## 🔍 Problem Analysis

**Primary Issue:**
- Production PDF uploads failing with Vision API errors
- Scanned PDFs cannot be processed due to missing Google Cloud credentials
- System falls back inadequately, causing upload failures

**Root Causes Identified:**
1. Missing `GOOGLE_APPLICATION_CREDENTIALS_JSON` in production environment
2. Inadequate fallback mechanisms when Vision API fails
3. Missing metadata tables for cross-document validation
4. Limited error handling for credential failures

## ✅ Solutions Implemented

### 1. Enhanced Vision API Fallback System

**Files Modified:**
- `services/vision-ocr-service.js` - Enhanced with credential checking and multiple fallback methods
- `services/enhanced-vision-service.js` - New fallback service using Tesseract.js

**Key Features:**
- Automatic credential validation before attempting Vision API calls
- Multi-tier fallback: Standard PDF parsing → Tesseract.js OCR → Graceful error handling
- Vietnamese + English OCR support for Tesseract fallback
- Graceful degradation with informative error messages

### 2. Production Database Setup

**Files Created:**
- `scripts/fix-production-deployment.js` - Automated production setup script
- `scripts/create-metadata-tables.sql` - Database schema for cross-validation features

**Tables Created:**
- `document_metadata` - Extracted entities per document
- `company_metadata` - Standardized company information
- `validation_logs` - Audit trail of corrections
- `entity_references` - Fast entity lookup

### 3. Enhanced Error Handling

**Improvements:**
- Credential validation before processing
- Multiple OCR fallback methods
- Informative error messages for users
- Non-blocking validation (uploads don't fail due to validation errors)

## 🚀 Deployment Instructions

### Step 1: Environment Variables

**Required Production Variables:**
```bash
# Google Cloud Configuration (CRITICAL for production)
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account","project_id":"your-project",...}'
GOOGLE_CLOUD_PROJECT_ID=your-google-cloud-project-id

# AI and Database
GEMINI_API_KEY=your-gemini-api-key
DATABASE_PUBLIC_URL=postgresql://user:pass@host:port/database

# Application Configuration
NODE_ENV=production
MAX_PDF_PAGES=20
PORT=3000
```

**How to Get GOOGLE_APPLICATION_CREDENTIALS_JSON:**
1. Go to Google Cloud Console
2. Navigate to IAM & Admin → Service Accounts
3. Create or select a service account with Vision API permissions
4. Generate a new key (JSON format)
5. Copy the entire JSON content to the environment variable

### Step 2: Run Production Setup

```bash
# Run the automated production fix
node scripts/fix-production-deployment.js

# This will:
# - Create metadata tables
# - Verify environment configuration
# - Test database connections
# - Set up enhanced fallback systems
```

### Step 3: Deploy and Test

1. **Deploy the updated code** to your production environment
2. **Restart the application** to load new environment variables
3. **Test with a scanned PDF** to verify the fallback system works

## 🧪 Testing the Fix

### Test 1: With Vision API Credentials
```bash
# Should use Vision API for high-quality OCR
curl -X POST -F "file=@scanned-document.pdf" \
     -F "companyId=1" \
     http://your-domain/api/documents/upload
```

### Test 2: Without Vision API Credentials
```bash
# Should fallback gracefully to Tesseract.js
unset GOOGLE_APPLICATION_CREDENTIALS_JSON
curl -X POST -F "file=@scanned-document.pdf" \
     -F "companyId=1" \
     http://your-domain/api/documents/upload
```

### Expected Results:
- ✅ PDF uploads should succeed in both cases
- ✅ Scanned PDFs get processed with appropriate OCR method
- ✅ Text-based PDFs use standard parsing
- ✅ Cross-document validation works when available

## 🔧 Troubleshooting

### Issue: Still getting "No images extracted" error

**Solution:**
1. Verify `GOOGLE_APPLICATION_CREDENTIALS_JSON` is correctly set
2. Check Google Cloud Service Account has Vision API permissions
3. Ensure the JSON credentials are valid and not corrupted
4. Test the credentials with: `node test-production-issues.js`

### Issue: Tesseract fallback fails

**Solution:**
1. Ensure `tesseract.js` is installed: `npm install tesseract.js`
2. Check if PDF can be converted to images
3. Verify temp directory permissions
4. Check memory limits (Tesseract can be memory-intensive)

### Issue: Database errors during setup

**Solution:**
1. Verify `DATABASE_PUBLIC_URL` connection string
2. Ensure database user has CREATE TABLE permissions
3. Check if base tables (documents, companies) exist
4. Run: `node scripts/fix-production-deployment.js` again

## 📊 Monitoring and Logs

### Key Log Messages to Monitor:

**Success Indicators:**
- `✅ Vision API extraction completed`
- `✅ Standard parsing successful`
- `✅ Tesseract.js OCR completed`
- `✅ Enhanced fallback successful`

**Warning Indicators:**
- `⚠️ Vision API credentials not available, using enhanced fallback`
- `⚠️ Vision API failed (...), using fallback`
- `⚠️ PDF appears to be empty or contains only images`

**Error Indicators:**
- `❌ All enhanced fallback methods failed`
- `❌ Vision API failed and enhanced fallback failed`
- `❌ Error in Vision API OCR`

## 🔄 Cross-Document Validation Features

The enhanced system now includes:

### Entity Extraction
- Automatic extraction of people, positions, departments, policies
- Confidence scoring for extracted entities
- Support for Vietnamese business documents

### OCR Correction
- Cross-reference entities between documents from the same company
- Automatic correction of OCR errors based on other documents
- Confidence-based application of corrections (>0.8 threshold)

### Standardized Metadata
- Company-wide standardized entity information
- Conflict resolution between documents
- Audit trail of all corrections and validations

### API Endpoints
- `GET /api/companies/:id/metadata` - Get standardized company metadata
- `GET /api/companies/:id/entities/:type` - Search specific entity types
- `GET /api/companies/:id/validation-logs` - View validation history

## 📈 Performance Considerations

### Production Optimizations:
- Limited Tesseract processing to 3 pages max for fallback
- Lower DPI (150) for fallback image conversion
- Memory management for large PDF processing
- Configurable page limits via `MAX_PDF_PAGES`

### Scaling Recommendations:
- Consider separate OCR processing queue for large documents
- Monitor memory usage during PDF processing
- Implement rate limiting for OCR-heavy operations
- Cache OCR results to avoid reprocessing

## 🎯 Next Steps

1. **Monitor production logs** for the first few days after deployment
2. **Test with various PDF types** (scanned, text-based, mixed)
3. **Fine-tune OCR settings** based on document quality
4. **Consider implementing** asynchronous processing for large documents
5. **Set up alerts** for Vision API quota limits and failures

## 📞 Support

If issues persist after following this guide:

1. Check the production logs for specific error messages
2. Run the diagnostic script: `node test-production-issues.js`
3. Verify all environment variables are correctly set
4. Test the fallback system with sample documents

---

**Last Updated:** January 2025  
**Version:** 2.0  
**Status:** Production Ready ✅ 