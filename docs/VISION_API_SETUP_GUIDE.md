# Google Cloud Vision API Setup Guide

## 🚀 Kích hoạt Google Cloud Vision API

### 1. Thiết lập Google Cloud Project
```bash
# Tạo project mới hoặc sử dụng project hiện có
gcloud projects create your-project-id
gcloud config set project your-project-id

# Kích hoạt Vision API
gcloud services enable vision.googleapis.com
```

### 2. Tạo Service Account
```bash
# Tạo service account
gcloud iam service-accounts create vision-ocr-service \
    --description="Service account for Vision OCR" \
    --display-name="Vision OCR Service"

# Gán quyền
gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:vision-ocr-service@your-project-id.iam.gserviceaccount.com" \
    --role="roles/vision.admin"

# Tạo key file
gcloud iam service-accounts keys create vision-key.json \
    --iam-account=vision-ocr-service@your-project-id.iam.gserviceaccount.com
```

### 3. Cấu hình Environment Variables

Thêm các biến môi trường sau vào file `.env`:

```env
# Google Cloud Vision API
GOOGLE_APPLICATION_CREDENTIALS=./vision-key.json
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Hoặc sử dụng JSON credentials trực tiếp
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account","project_id":"your-project-id",...}

# Google Cloud Storage (nếu chưa có)
GCS_BUCKET_NAME=your-bucket-name

# Google Gemini AI (nếu chưa có)
GEMINI_API_KEY=your-gemini-api-key
```

### 4. Test Vision API

```bash
# Test API hoạt động
curl -X POST "https://vision.googleapis.com/v1/images:annotate?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {
        "image": {
          "content": "base64-encoded-image-content"
        },
        "features": [
          {
            "type": "TEXT_DETECTION"
          }
        ]
      }
    ]
  }'
```

## 🔧 Cấu hình bổ sung

### Authentication Options

**Option 1: Service Account Key File**
```env
GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account-key.json
```

**Option 2: JSON Credentials (Railway/Heroku)**
```env
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
```

**Option 3: Default Application Credentials**
```bash
gcloud auth application-default login
```

### Pricing & Quotas

- **Free tier**: 1,000 units/month
- **Paid tier**: $1.50 per 1,000 units
- **Rate limits**: 600 requests/minute

### Error Handling

Common errors and solutions:

1. **Authentication Error**
   ```
   Error: Could not load the default credentials
   ```
   Solution: Check GOOGLE_APPLICATION_CREDENTIALS path

2. **Permission Error**
   ```
   Error: Permission denied
   ```
   Solution: Ensure service account has Vision API access

3. **Quota Exceeded**
   ```
   Error: Quota exceeded
   ```
   Solution: Check billing and increase quotas

## 📊 Performance Comparison

| Feature | Tesseract | Vision API |
|---------|-----------|------------|
| **Accuracy** | 85-90% | 95-99% |
| **Speed** | 10-30s | 1-3s |
| **Vietnamese Support** | Good | Excellent |
| **Cost** | Free | $1.50/1k requests |
| **Offline** | Yes | No |

## 🔄 Migration Steps

1. **Backup current OCR service**
   ```bash
   cp ocr-service.js ocr-service.backup.js
   ```

2. **Update dependencies**
   ```bash
   npm install @google-cloud/vision
   ```

3. **Configure credentials**
   - Set up service account
   - Add environment variables

4. **Test with sample document**
   ```bash
   curl -X POST http://localhost:3000/api/upload \
     -F 'document=@sample.pdf'
   ```

5. **Monitor performance**
   - Check processing times
   - Monitor API usage
   - Verify accuracy improvements

## 🛡️ Security Best Practices

1. **Service Account Security**
   - Use least privilege principle
   - Rotate keys regularly
   - Never commit keys to version control

2. **API Key Protection**
   - Store in environment variables
   - Use secrets management
   - Implement request validation

3. **Rate Limiting**
   - Implement client-side throttling
   - Monitor API usage
   - Set up alerts for quota limits

## 🚨 Troubleshooting

### Common Issues

1. **File not found**: Check GOOGLE_APPLICATION_CREDENTIALS path
2. **Permission denied**: Verify service account roles
3. **Network timeout**: Check firewall/proxy settings
4. **Invalid image format**: Ensure proper image conversion

### Debug Commands

```bash
# Check credentials
gcloud auth list

# Test API access
gcloud auth application-default print-access-token

# Check project settings
gcloud config list
```

---

**🎯 Kết quả mong đợi:**
- Độ chính xác OCR tăng từ 85% lên 95%
- Thời gian xử lý giảm từ 30s xuống 3s
- Hỗ trợ tiếng Việt tốt hơn
- Tự động phân loại và từ chối file rác
- Merge tự động các document trùng lặp 