# Production Issues & Solutions

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## Common Issues

### 1. File Upload Fails (502/500)
- **Causes:**
  - Google Vision API timeout (large files)
  - Insufficient memory/CPU (Railway, Docker)
  - Missing/invalid environment variables
  - File size exceeds limit
- **Solutions:**
  - Check logs: `railway logs` or `docker logs`
  - Verify all required env vars (see README)
  - Increase memory/timeout in deployment config
  - Test with smaller files first
  - Use manual document creation as fallback

### 2. Migration/Schema Errors
- **Causes:**
  - Outdated schema, missing columns
- **Solutions:**
  - Always run migration script before start (auto-run in production)
  - Check logs for missing columns, update migrate script if needed

### 3. Health Check Fails
- **Causes:**
  - Server not running or crashed
- **Solutions:**
  - Check `/health` endpoint
  - Review logs for crash details

## Deployment Checklist
- All env vars set (DB, Google, Storage, AI)
- Sufficient memory/timeout for uploads
- Migration runs on every deploy
- Health check returns 200 OK

---
**Contact: Tran Minh Khoi, IT Department, Phat Dat Holdings** 