# 🚀 Railway Deployment Guide

Complete guide để deploy PDF Knowledge Management System lên Railway.

## 📋 Pre-deployment Checklist

### ✅ Required Files (đã có)
- `nixpacks.toml` - System dependencies (ImageMagick, Tesseract)
- `railway.json` - Railway configuration
- `.railwayignore` - Files to exclude from deployment
- `setup-production.js` - Production environment setup
- `constraints.json` - Constraint data
- `eng.traineddata` & `vie.traineddata` - OCR language files

### ✅ Environment Variables (bạn đã cấu hình)

#### Database
```
DATABASE_PUBLIC_URL="${{PD-Knowledge-Production.DATABASE_PUBLIC_URL}}"
POSTGRES_USER="${{PD-Knowledge-Production.POSTGRES_USER}}"
POSTGRES_PASSWORD="${{PD-Knowledge-Production.POSTGRES_PASSWORD}}"
PGPASSWORD="${{PD-Knowledge-Production.PGPASSWORD}}"
```

#### Google Cloud & AI
```
GEMINI_API_KEY="AIzaSyCOWyP9vC31PVltexJUlinX-7wiU16LsJ0"
GCS_BUCKET_NAME="pd-knowledge-files"
GOOGLE_CLOUD_PROJECT_ID="gmn-2-5-api"
GOOGLE_APPLICATION_CREDENTIALS_JSON="{...service account json...}"
```

#### App Configuration
```
NODE_ENV="production"
MAX_FILE_SIZE="10485760"
```

### ⚠️ **Recommended Addition:**
```
PORT=8080
TESSDATA_PREFIX="/app"
```

## 🚀 Deployment Steps

### 1. Push Code to GitHub
```bash
git add .
git commit -m "feat: add Railway deployment configuration"
git push origin main
```

### 2. Deploy on Railway
1. Go to [Railway.app](https://railway.app)
2. Connect your GitHub repo
3. Railway will auto-detect and deploy using Nixpacks

### 3. Verify Environment Variables
Railway Dashboard → Your Project → Variables → Check all env vars are set

### 4. Monitor Deployment
Check build logs for:
- ✅ Nixpacks installing ImageMagick & Tesseract
- ✅ Production setup script running
- ✅ Server starting on correct port

## 🔍 Troubleshooting

### Common Issues & Solutions

#### 1. **OCR not working**
```bash
# Check if Tesseract is installed
which tesseract

# Check language files
ls /app/*.traineddata
```
**Solution:** Ensure `nixpacks.toml` is present and correct

#### 2. **Database connection fails**
**Check:**
- DATABASE_PUBLIC_URL format
- Network policies (Railway → External connections)
- Database is running and accessible

#### 3. **Google Cloud Storage errors**
**Check:**
- Service account has Storage Admin permissions
- Bucket exists and is accessible
- GOOGLE_APPLICATION_CREDENTIALS_JSON is valid JSON

#### 4. **Port binding errors**
**Solution:** Railway auto-sets PORT, but ensure server listens on `process.env.PORT`

#### 5. **File upload fails**
**Check:**
- MAX_FILE_SIZE setting
- Disk space on Railway
- Temporary directories created

## 📊 Post-Deployment Verification

### 1. Health Check
```bash
curl https://your-app.railway.app/health
# Should return: {"status":"OK","timestamp":"..."}
```

### 2. Test Upload
```bash
curl -X POST https://your-app.railway.app/api/upload \
  -F 'document=@test.pdf'
```

### 3. Test Q&A
```bash
curl -X POST https://your-app.railway.app/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "PDH là công ty gì?"}'
```

### 4. Test OCR (if you have scanned PDFs)
Upload a scanned PDF và check logs for OCR processing

## 🔧 Production Configuration

### Performance Settings
- **Memory:** Railway default (512MB-1GB should be enough)
- **CPU:** Shared (upgrade if needed for heavy OCR)
- **Disk:** 1GB (for temp files and uploads)

### Monitoring
- Check Railway Metrics tab for:
  - Memory usage
  - CPU usage  
  - Network I/O
  - Response times

### Scaling
- Railway auto-scales based on traffic
- For high OCR workload, consider upgrading plan

## 🛡️ Security Checklist

### ✅ Environment Variables
- [ ] No hardcoded secrets in code
- [ ] All sensitive data in Railway env vars
- [ ] Service account has minimal required permissions

### ✅ Rate Limiting
- [ ] Current: 100 requests/15min per IP
- [ ] Adjust if needed for production load

### ✅ CORS
- [ ] Configure allowed origins for web frontend
- [ ] Currently allows all origins

### ✅ File Upload Security
- [ ] Only PDF files allowed
- [ ] File size limit: 10MB
- [ ] Validate file content

## 📈 Production Optimizations

### 1. **Constraint System**
- Pre-configure common Q&A for instant responses (35ms)
- Use `/api/constraints` to add frequent questions

### 2. **Document Quality**
- Use `/api/documents/:id/reprocess` to improve OCR text
- Regular cleanup of temp files

### 3. **Database Optimization**
- Monitor query performance
- Consider indexes for frequent searches
- Regular database maintenance

### 4. **AI Performance**
- Monitor Gemini API usage and costs
- Optimize prompts for better responses
- Cache common results if possible

## 🔄 CI/CD Pipeline (Optional)

### GitHub Actions for Auto-deployment
```yaml
# .github/workflows/deploy.yml
name: Deploy to Railway
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      # Railway auto-deploys on push
```

## 📞 Support & Monitoring

### Health Check Endpoints
- `GET /health` - Basic health check
- `GET /api/documents` - Database connectivity
- `POST /api/ask` - AI service test

### Log Monitoring
Railway provides real-time logs. Watch for:
- Database connection errors
- OCR processing times
- AI API failures
- File upload issues

### Performance Metrics
- Response times by endpoint type:
  - Constraints: 35-50ms ⚡
  - Document search: 100-500ms 🔍
  - AI Q&A: 1-10s 🧠
  - OCR processing: 10-30s 📄

---

## 🎉 You're Ready!

Với environment variables hiện tại của bạn + các files mới này, hệ thống sẽ deploy thành công trên Railway! 

### Next Steps:
1. Push code với files mới
2. Verify trên Railway Dashboard  
3. Test basic functionality
4. Configure constraints cho common questions
5. Upload và test documents

**Railway URL sẽ có dạng:** `https://pd-knowledge-production.up.railway.app` 