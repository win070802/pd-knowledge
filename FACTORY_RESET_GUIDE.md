# 🔄 Factory Reset Guide

## Overview

Factory Reset feature allows you to completely clear all data and reset the system to a clean state. This is particularly useful for:
- Testing and development
- Cleaning up test data
- Starting fresh after experiments
- Resetting corrupted data

⚠️ **WARNING**: Factory reset will permanently delete ALL data!

---

## What Gets Deleted

### 📊 Database
- All documents and their content
- All companies (PDH, PDI, etc.)
- All knowledge base entries
- All Q&A history
- All user data and settings

### 📁 File System
- `/uploads/` - All uploaded PDF files
- `/temp/` - Temporary processing files  
- `/temp-images/` - OCR image files

### ☁️ Cloud Storage
- All files in Google Cloud Storage bucket
- Document storage and backups

---

## How to Use Factory Reset

### Method 1: Environment Variable (Auto Reset on Startup)

**Step 1**: Set environment variable
```bash
# In your .env file or Railway dashboard
FACTORY_RESET=true
```

**Step 2**: Restart server
```bash
# Local development
npm start

# Railway deployment will auto-restart
```

**Output**:
```
🚨 ===============================================
🚨 PERFORMING FACTORY RESET - DELETING ALL DATA
🚨 ===============================================

🗃️ Clearing database tables...
✅ Database tables cleared

📁 Clearing local files...
✅ Cleared and recreated: ./uploads
✅ Cleared and recreated: ./temp
✅ Cleared and recreated: ./temp-images

☁️ Clearing Google Cloud Storage...
📄 Found 15 files in cloud storage
✅ Cloud storage cleared

🔧 Reinitializing database schema...
✅ Database schema reinitialized

🏢 Creating default companies...
✅ Created company: PDH - Phát Đạt Holdings
✅ Created company: PDI - Phát Đạt Industrials

✅ ===============================================
✅ FACTORY RESET COMPLETED SUCCESSFULLY
✅ All data has been cleared and reset
✅ ===============================================
```

**Step 3**: Disable factory reset
```bash
# Set to false to prevent accidental resets
FACTORY_RESET=false
```

### Method 2: API Endpoint (Manual Trigger)

**Endpoint**: `POST /api/debug/factory-reset`

**Request**:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"confirm": "DELETE_ALL_DATA"}' \
  https://your-domain.com/api/debug/factory-reset
```

**Response**:
```json
{
  "success": true,
  "message": "Factory reset completed successfully",
  "actions": [
    "All database tables dropped and recreated",
    "All local files deleted", 
    "All cloud storage files deleted",
    "Default companies (PDH, PDI) created"
  ],
  "timestamp": "2025-07-15T03:00:00.000Z"
}
```

---

## Check Factory Reset Status

**Endpoint**: `GET /api/debug/factory-reset-status`

```bash
curl https://your-domain.com/api/debug/factory-reset-status
```

**Response**:
```json
{
  "success": true,
  "factoryResetEnabled": false,
  "environment": "production",
  "warning": null,
  "instructions": {
    "enableReset": "Set FACTORY_RESET=true in environment variables",
    "triggerReset": "POST /api/debug/factory-reset with {\"confirm\": \"DELETE_ALL_DATA\"}",
    "disableReset": "Set FACTORY_RESET=false or remove the variable"
  }
}
```

---

## Safety Features

### 🔒 Confirmation Required
- API endpoint requires exact confirmation: `{"confirm": "DELETE_ALL_DATA"}`
- Environment variable must be explicitly set to `"true"`

### 📝 Detailed Logging
- Every action is logged with success/failure status
- Clear messages about what data was deleted
- Errors are caught and reported

### 🏢 Auto-Recreation
- Default companies (PDH, PDI) are automatically recreated
- Database schema is properly reinitialized
- System is left in a usable state

### 🚨 Visual Warnings
- Clear warning messages during reset process
- Server startup shows reset status
- API responses include warning messages

---

## Use Cases

### 🧪 Development Testing
```bash
# Test with sample data
curl -X POST -F "document=@test.pdf" /api/upload

# Reset and test again
FACTORY_RESET=true npm start
```

### 🔄 Clean Production Data
```bash
# 1. Check current status
curl /api/debug/factory-reset-status

# 2. Backup important data (if needed)

# 3. Trigger reset
curl -X POST -H "Content-Type: application/json" \
  -d '{"confirm": "DELETE_ALL_DATA"}' /api/debug/factory-reset

# 4. Verify system is clean
curl /api/documents  # Should return empty array
curl /api/companies  # Should return only PDH, PDI
```

### 🎯 Railway Deployment Reset
```bash
# 1. Add environment variable in Railway dashboard:
FACTORY_RESET=true

# 2. Deploy or restart
git push origin main

# 3. Check logs to confirm reset
railway logs

# 4. Remove environment variable
# (Delete FACTORY_RESET from Railway dashboard)
```

---

## Troubleshooting

### Reset Doesn't Work
- Check server logs for specific errors
- Verify environment variable spelling: `FACTORY_RESET=true`
- Ensure Google Cloud credentials are correct
- Check file permissions for local folders

### Partial Reset
- If database clears but files remain, check folder permissions
- If cloud storage doesn't clear, verify GCS credentials
- Individual components can fail independently

### Cannot Connect After Reset
- Database schema may have failed to reinitialize
- Check PostgreSQL connection
- Restart server to retry initialization

---

## Best Practices

### 🛡️ Production Safety
- **NEVER** set `FACTORY_RESET=true` in production long-term
- Always backup important data before reset
- Use API endpoint for controlled resets
- Test factory reset in development first

### 🔄 Development Workflow
```bash
# 1. Work with test data
npm start

# 2. When ready to reset
echo "FACTORY_RESET=true" >> .env
npm start

# 3. Disable reset
echo "FACTORY_RESET=false" >> .env
```

### 📋 Reset Checklist
- [ ] Backup any important data
- [ ] Confirm you want to delete ALL data
- [ ] Set `FACTORY_RESET=true` or use API
- [ ] Restart server / trigger reset
- [ ] Verify clean state
- [ ] Disable factory reset (`FACTORY_RESET=false`)
- [ ] Re-upload necessary documents

---

## Security Notes

- Factory reset is a **destructive operation**
- Only enable in development/testing environments
- Use API endpoint for production if needed
- Monitor environment variables in production
- Consider implementing additional authentication for API endpoint

---

Ready to reset? Remember: **This will delete ALL data permanently!** 🚨 