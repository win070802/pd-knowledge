# CockroachDB Setup Guide

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## Overview
This project supports CockroachDB as a drop-in replacement for PostgreSQL. All migrations and features are compatible.

## Quick Setup
1. **Provision CockroachDB (Cloud or Self-hosted)**
2. **Set `DATABASE_URL` in `.env`**
   - Example: `postgresql://user:pass@host:port/db?sslmode=verify-full`
3. **Run migration:**
   - On production, migration runs automatically on server start.
   - For local/dev: `node scripts/migrate-production.js`

## Notes
- All schema changes are handled by the migration script.
- Use SSL for production.
- Default admin user is always created/updated on migrate.

## Troubleshooting
- Check logs for connection or schema errors.
- Ensure all required CockroachDB extensions are enabled (if needed).

---
**Contact: Tran Minh Khoi, IT Department, Phat Dat Holdings** 