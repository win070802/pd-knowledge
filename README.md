# PDF Knowledge Management System

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## Purpose
A modern, AI-powered knowledge/document management system for Phat Dat Holdings. Supports smart PDF upload, OCR, company-specific knowledge, and advanced Q&A.

## Quick Start

### 1. Install
```bash
npm install
cp .env.example .env
# Edit .env for DB, Google Cloud, and storage
```

### 2. Run Server
```bash
export $(cat .env | grep -v '#' | xargs) && PORT=3000 node server.js
```

### 3. Admin Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "admin", "password": "Admin@123123"}'
```

### 4. Main APIs
- **Upload PDF:** `/api/upload` (admin, multipart/form-data, field: `file`)
- **Ask Question:** `/api/ask` (public)
- **Learn Knowledge:** `/api/learn` (admin)
- **Companies:** `/api/companies` (public)
   
## Environment Variables
- `DATABASE_URL` (Postgres/CockroachDB)
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` (Google Cloud Vision)
- `GCS_BUCKET_NAME` (Cloud Storage)
- `GEMINI_API_KEY` (AI)
- `MAX_FILE_SIZE`, `UPLOAD_TIMEOUT_MINUTES`, ... (see .env.example)

## Features
- **Smart PDF Upload:** Auto-detect company, OCR, metadata extraction, cloud storage
- **AI Q&A:** Answers from both documents and learned knowledge
- **Knowledge Base:** Add/update knowledge, company-specific
- **Admin Auth:** JWT, default admin: `admin`/`Admin@123123`
- **Production-ready Migration:** Schema auto-migrates on deploy

## Project Structure
- `src/controllers/` — API logic
- `src/repositories/` — DB access
- `src/routes/` — API endpoints
- `services/` — AI, OCR, storage
- `scripts/` — Migration, setup

## Production Setup
- Set all required env vars (see above)
- Deploy (Railway, Docker, etc.)
- On start, schema auto-migrates (no manual SQL needed)
- Health check: `/health` (returns 200 OK)

## Requirements
- Node.js 18+
- PostgreSQL or CockroachDB
- Google Cloud Vision & Storage
- Tesseract OCR, GraphicsMagick

---
**Copyright © Tran Minh Khoi, IT Department, Phat Dat Holdings** 

## Railway Deployment Instructions

### Overview
This project is configured to deploy on Railway using Nixpacks as the build system. Docker configuration has been deprecated in favor of Nixpacks for easier maintenance.

### Deployment Steps

1. **Prerequisites**
   - Railway account with CLI access
   - Project set up on Railway

2. **Deploy Commands**
   ```bash
   # Login to Railway
   railway login

   # Link to your project
   railway link

   # Deploy the application
   railway up
   ```

3. **Important Configuration Files**
   - `railway.toml` - Main Railway configuration
   - `config/nixpacks.toml` - Build configuration
   - `package.json` - Contains railway:start script

4. **Environment Variables**
   The following environment variables must be set in Railway:

   ```
   DATABASE_URL=your_cockroachdb_connection_string
   GOOGLE_APPLICATION_CREDENTIALS_JSON=your_google_json_credentials
   GOOGLE_CLOUD_PROJECT_ID=your_gcp_project_id
   GEMINI_API_KEY=your_gemini_api_key
   ```

5. **Resources**
   - Memory: 3GB
   - vCPU: 1
   - Scale according to your needs

6. **Healthcheck**
   - Path: `/health`
   - Timeout: 300 seconds 

## Deployment

The application is configured to automatically run database migrations when deployed to Railway through the `railway:start` script in package.json.

This script sequence:
1. Creates the database if it doesn't exist
2. Runs all migrations to ensure correct database structure
3. Starts the server

No manual intervention required for migrations on deployment. 