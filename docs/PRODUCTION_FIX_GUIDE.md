# Production Fix Guide

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## Common Fixes

### 1. Migration/Schema Issues
- Always run `node scripts/migrate-production.js` before starting server
- Check logs for missing columns or errors
- Update migration script if schema changes

### 2. File Upload/Processing Errors
- Check Google Cloud credentials and storage config
- Increase memory/timeout if needed
- Test with smaller files first

### 3. Auth/Token Issues
- Ensure JWT secret and admin credentials are set
- Reset admin password via migration script if needed

## Deployment Tips
- Set all required env vars
- Use health check `/health` for monitoring
- Restart server after any config change

---
**Contact: Tran Minh Khoi, IT Department, Phat Dat Holdings** 