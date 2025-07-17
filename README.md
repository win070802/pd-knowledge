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