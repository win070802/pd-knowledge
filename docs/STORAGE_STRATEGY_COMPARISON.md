# Storage Strategy Comparison

## 🎯 Current Implementation: Google Cloud Storage

The system uses **Google Cloud Storage (GCS)** for reliable, scalable file storage with intelligent organization.

## 📊 Storage Options Comparison

| Feature | Local Storage | Google Cloud Storage | AWS S3 | Azure Blob |
|---------|---------------|---------------------|---------|------------|
| **Scalability** | Limited by disk | Unlimited | Unlimited | Unlimited |
| **Reliability** | Single point failure | 99.999% uptime | 99.999% uptime | 99.9% uptime |
| **Cost** | Server storage cost | $0.020/GB/month | $0.023/GB/month | $0.024/GB/month |
| **Setup Complexity** | None | Medium | Medium | Medium |
| **Global Access** | Server dependent | Global CDN | Global CDN | Global CDN |
| **Security** | Server-dependent | IAM + encryption | IAM + encryption | RBAC + encryption |

## 🏗️ Current Architecture

### File Organization
```
gs://your-bucket/
├── PDH/
│   ├── Quy_dinh/
│   ├── Quy_trinh/
│   ├── Tai_chinh/
│   └── Chinh_sach/
├── PDI/
│   ├── Quy_trinh/
│   └── San_xuat/
└── PDE/
    ├── Nang_luong/
    └── Quy_trinh/
```

### Benefits of Current Setup
- **Automatic organization** by company and category
- **Scalable storage** without server limits
- **Global accessibility** via CDN
- **Backup and versioning** built-in
- **Integration with Railway** deployment

## ⚙️ Configuration

### Required Environment Variables
```bash
# Service account for authentication
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'

# Target bucket name
GCS_BUCKET_NAME=pd-knowledge-files

# Optional: Project ID
GOOGLE_CLOUD_PROJECT_ID=your-project-id
```

### Storage Service Features
```javascript
// Automatic company detection
detectCompanyFromFile(filename)

// Smart folder creation
uploads/{Company}/{Category}/filename.pdf

// Upload with metadata
uploadToCloud(file, company, category)
```

## 📈 Performance Metrics

### Upload Performance
| File Type | Size | Upload Time | OCR Time |
|-----------|------|-------------|----------|
| Standard PDF | 1MB | 200-500ms | N/A |
| Scanned PDF | 5MB | 1-2s | 10-30s |
| Large Document | 10MB | 2-5s | 30-60s |

### Storage Costs (Monthly)
```
100 documents × 2MB average = 200MB
Cost: 200MB × $0.020/GB = $0.004/month

1,000 documents × 2MB = 2GB  
Cost: 2GB × $0.020 = $0.04/month

10,000 documents × 2MB = 20GB
Cost: 20GB × $0.020 = $0.40/month
```

## 🔄 Alternative Strategies

### 1. Local Storage Only
```javascript
// Simple but limited
app.use(express.static('uploads'))
```

**Pros:**
- No external dependencies
- Zero storage costs
- Immediate access

**Cons:**
- Limited by server disk space
- No backup/redundancy
- Difficult to scale
- Files lost if server crashes

### 2. Hybrid Storage
```javascript
// Local for temp, cloud for permanent
tempStorage → processing → cloudStorage
```

**Pros:**
- Fast processing
- Reliable backup
- Cost optimization

**Cons:**
- Complex setup
- Sync complexity
- Potential data loss during transfer

### 3. Database Storage (Not Recommended)
```sql
-- Storing files as BLOB
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  content BYTEA  -- File content
);
```

**Pros:**
- Single storage location
- ACID compliance

**Cons:**
- Database bloat
- Poor performance
- Expensive backup
- Size limitations

## 🛠️ Implementation Details

### GCS Upload Flow
```javascript
1. Receive file via multer
2. Detect company from filename
3. Determine category from content
4. Generate cloud path: uploads/{company}/{category}/
5. Upload to GCS with metadata
6. Store metadata in PostgreSQL
7. Return success response
```

### Error Handling
```javascript
// Graceful fallback
try {
  await uploadToCloud(file)
} catch (error) {
  // Log error but continue processing
  console.error('Cloud upload failed:', error)
  // File metadata still saved to DB
}
```

## 📋 Migration Guide

### From Local to Cloud Storage
```bash
# 1. Setup GCS bucket
gsutil mb gs://your-bucket-name

# 2. Upload existing files
gsutil -m cp -r uploads/ gs://your-bucket-name/

# 3. Update environment variables
export GCS_BUCKET_NAME=your-bucket-name
export GOOGLE_APPLICATION_CREDENTIALS_JSON='...'

# 4. Deploy with new configuration
```

### Backup Strategy
```bash
# Automated daily backup
gsutil -m rsync -r -d gs://your-bucket-name/ gs://backup-bucket-name/

# Export database
pg_dump $DATABASE_PUBLIC_URL > backup.sql
```

## 🔒 Security Considerations

### GCS Security
- **IAM policies** restrict access to service account only
- **Signed URLs** for temporary access (if needed)
- **Encryption at rest** enabled by default
- **Audit logging** for access tracking

### Access Control
```javascript
// Private bucket - no public access
// Files accessed only through application
// Metadata stored in database for permission checking
```

## 📊 Monitoring & Analytics

### Storage Metrics
- **Total storage used**: Monitor bucket size
- **Upload success rate**: Track failed uploads
- **Access patterns**: Analyze file access logs
- **Cost tracking**: Monthly GCS billing

### Performance Monitoring
```bash
# Check bucket usage
gsutil du -sh gs://your-bucket-name

# Monitor upload performance
gsutil perfdiag gs://your-bucket-name
```

---

**Current GCS strategy provides optimal balance of reliability, scalability, and cost for enterprise document management.** 