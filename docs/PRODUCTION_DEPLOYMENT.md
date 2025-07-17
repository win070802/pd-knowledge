# Production Deployment Guide

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## Steps
1. Set all required environment variables (.env or platform dashboard)
2. Deploy code (Railway, Docker, etc.)
3. On start, migration runs automatically
4. Health check: `/health` (should return 200 OK)

## Required Env Vars
- `DATABASE_URL`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `GCS_BUCKET_NAME`
- `GEMINI_API_KEY`
- `ADMIN_PASSWORD` (optional, for admin user)

## Tips
- Use Railway or Docker for easy deployment
- Monitor logs for errors
- Increase memory/timeout for large file uploads
- Always test health check after deploy

---
**Contact: Tran Minh Khoi, IT Department, Phat Dat Holdings** 