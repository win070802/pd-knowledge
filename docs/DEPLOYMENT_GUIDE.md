# Deployment Guide

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## Steps
1. Clone the repo and install dependencies
2. Set all required environment variables
3. Run migration: `node scripts/migrate-production.js`
4. Start the server: `node server.js`

## Required Env Vars
- `DATABASE_URL`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `GCS_BUCKET_NAME`
- `GEMINI_API_KEY`

## Tips
- Use Railway, Docker, or any Node.js hosting
- Migration script will auto-create/update schema
- Health check: `/health`

---
**Contact: Tran Minh Khoi, IT Department, Phat Dat Holdings** 