# Project Structure

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## Main Folders
- `src/controllers/` — API logic (auth, documents, QA, learn, etc.)
- `src/repositories/` — Database access (users, documents, companies, ...)
- `src/routes/` — API endpoints
- `src/middleware/` — Auth, security, rate limiting
- `src/models/` — (Legacy, not used for schema)
- `services/` — AI, OCR, storage, Gemini, Vision
- `config/` — DB, multer, and other configs
- `scripts/` — Migration, setup, factory reset
- `data/` — Training data, test files
- `docs/` — Documentation
- `server.js` — Main entry point
- `database.js` — DB interface

## Key Points
- All schema/migration logic is in `scripts/migrate-production.js`
- No ORM; direct SQL for full control
- All uploads go to `/uploads` or cloud storage
- Environment variables are required for DB, Google Cloud, and storage

---
**Contact: Tran Minh Khoi, IT Department, Phat Dat Holdings** 