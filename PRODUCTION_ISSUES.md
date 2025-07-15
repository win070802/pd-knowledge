# 🚨 Production Issues & Solutions

## Current Status: `https://ai.tranminhkhoi.dev`

### ✅ **WORKING FEATURES**
- ✅ Health check: `/health`
- ✅ Companies API: `/api/companies`
- ✅ Q&A System: `/api/ask`
- ✅ Knowledge Base: `/api/knowledge`

### ⚠️ **ISSUES FOUND**

#### 1. File Upload Errors (502/500)
**Problem:**
- PDF uploads return 502 error (gateway timeout)
- Text files return 500 error (internal server error)

**Likely Causes:**
- Google Cloud Vision API timeout (processing large files)
- Railway memory/CPU limits exceeded during OCR
- Missing environment variables in production
- File size limits on Railway

**Solutions to Try:**

##### A. Check Railway Logs:
```bash
railway logs
```

##### B. Verify Environment Variables:
```bash
# In Railway dashboard, ensure these are set:
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_CLOUD_PROJECT_ID=gmn-2-5-api
GCS_BUCKET_NAME=pd-knowledge-files
```

##### C. Add Memory/CPU Limits:
Update `railway.json`:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE", 
    "restartPolicyMaxRetries": 3,
    "memoryGB": 2,
    "vcpus": 1
  }
}
```

##### D. Add Request Timeout:
Update `server.js`:
```javascript
// Increase timeout for uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Add timeout middleware
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000);
  next();
});
```

##### E. Temporary Workaround - Manual Data Entry:
Since upload is failing, manually create documents via API:

```bash
# Create sample document
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "original_name": "PDI-Company-Info.pdf",
    "content_text": "PDI - Phát Đạt Industrials\nCEO: Vũ Văn Luyến\nChairman: Phạm Trọng Hòa\nQuy định nghỉ phép: 12 ngày/năm có lương",
    "company_id": 2,
    "category": "Thông tin công ty",
    "processed": true
  }' \
  https://ai.tranminhkhoi.dev/api/documents
```

### 🎯 **IMMEDIATE ACTIONS**

1. **Check Railway logs** for specific error details
2. **Verify Google Cloud credentials** are properly formatted
3. **Increase memory/timeout limits** if needed
4. **Test with smaller files** first
5. **Use manual document creation** as temporary workaround

### 📞 **Support Options**

- Railway Discord/Support for platform issues
- Google Cloud Support for Vision API problems
- Manual database insertion if needed

---

**Next Steps:**
1. Fix upload issues 
2. Upload PDH documents successfully
3. Test full Q&A workflow
4. Add more knowledge base entries 