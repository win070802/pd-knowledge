# Deployment Guide

## 🚀 Quick Deploy to Railway

### 1. Prerequisites
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login
```

### 2. Setup Project
```bash
# Create new Railway project
railway new

# Link to existing project (if applicable)
railway link [project-id]
```

### 3. Environment Variables
Set these in Railway dashboard or CLI:

```bash
# Database (PostgreSQL plugin auto-generates this)
DATABASE_PUBLIC_URL=postgresql://...

# AI Service
GEMINI_API_KEY=your_gemini_api_key

# Google Cloud Storage
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
GCS_BUCKET_NAME=your-bucket-name

# Optional
NODE_ENV=production
MAX_FILE_SIZE=10485760
```

### 4. Deploy
```bash
# Deploy current directory
railway up

# Or connect to GitHub for auto-deploy
railway connect
```

## 🐳 Docker Deployment

### Using Provided Dockerfile
```bash
# Build image
docker build -t pd-knowledge .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_PUBLIC_URL="..." \
  -e GEMINI_API_KEY="..." \
  -e GOOGLE_APPLICATION_CREDENTIALS_JSON="..." \
  -e GCS_BUCKET_NAME="..." \
  pd-knowledge
```

### Docker Compose (Development)
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_PUBLIC_URL=postgresql://user:pass@db:5432/dbname
      - GEMINI_API_KEY=your_key
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: pd_knowledge
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## ☁️ Google Cloud Setup

### 1. Create Service Account
```bash
# Create service account
gcloud iam service-accounts create pd-knowledge-service

# Create and download key
gcloud iam service-accounts keys create key.json \
  --iam-account=pd-knowledge-service@your-project.iam.gserviceaccount.com

# Grant storage permissions
gcloud projects add-iam-policy-binding your-project-id \
  --member="serviceAccount:pd-knowledge-service@your-project.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

### 2. Create Storage Bucket
```bash
# Create bucket
gsutil mb gs://your-bucket-name

# Set public access (if needed)
gsutil iam ch allUsers:objectViewer gs://your-bucket-name
```

## 🗄️ Database Setup

### PostgreSQL Setup
```sql
-- Create database
CREATE DATABASE pd_knowledge;

-- Create user (optional)
CREATE USER pd_admin WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE pd_knowledge TO pd_admin;
```

The application will auto-create tables on first startup.

## 🔧 Production Configuration

### Environment Variables Checklist
- [ ] `DATABASE_PUBLIC_URL` - PostgreSQL connection string
- [ ] `GEMINI_API_KEY` - Google AI API key  
- [ ] `GOOGLE_APPLICATION_CREDENTIALS_JSON` - GCS service account JSON
- [ ] `GCS_BUCKET_NAME` - Google Cloud Storage bucket name
- [ ] `NODE_ENV=production` - Enables production optimizations
- [ ] `PORT` - Server port (Railway auto-assigns)

### Security Checklist
- [ ] Database password is strong
- [ ] API keys are secure and rotated regularly
- [ ] GCS bucket has proper IAM permissions
- [ ] Rate limiting is enabled (default: 100 req/15min)
- [ ] CORS is configured for your domain

## 📊 Health Monitoring

### Health Check Endpoint
```bash
# Test deployment
curl https://your-app.railway.app/health

# Expected response
{
  "status": "OK",
  "timestamp": "2024-07-14T16:00:00.000Z"
}
```

### Application Logs
```bash
# Railway logs
railway logs

# Docker logs  
docker logs container-name

# Local development
npm run dev  # Shows detailed logs
```

## 🚨 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check connection string format
postgresql://user:password@host:port/database

# Verify database is accessible
psql $DATABASE_PUBLIC_URL -c "SELECT 1;"
```

**GCS Upload Failed**
```bash
# Verify service account JSON is valid
echo $GOOGLE_APPLICATION_CREDENTIALS_JSON | jq .

# Test bucket access
gsutil ls gs://your-bucket-name
```

**OCR Not Working**
```bash
# Install system dependencies (if using custom container)
apt-get update && apt-get install -y \
  tesseract-ocr \
  tesseract-ocr-vie \
  graphicsmagick

# Or use provided Dockerfile which includes these
```

## 🔄 Updates & Maintenance

### Updating Application
```bash
# Railway (auto-deploy from Git)
git push origin main

# Manual Railway deploy
railway up

# Docker
docker build -t pd-knowledge . && docker stop old-container && docker run ...
```

### Database Migrations
Application handles schema updates automatically on startup. For manual control:

```sql
-- Check current schema
\d documents

-- Add new columns (example)
ALTER TABLE documents ADD COLUMN new_field TEXT;
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Use load balancer for multiple instances
- Database connection pooling (already implemented)
- Shared cloud storage (Google Cloud Storage)

### Performance Monitoring
- Monitor response times via `/health` endpoint
- Database query performance
- GCS upload/download speeds
- Memory usage (Node.js heap)

---

**Note**: This system is optimized for Railway deployment but can run on any Node.js hosting platform with PostgreSQL and Google Cloud Storage access. 