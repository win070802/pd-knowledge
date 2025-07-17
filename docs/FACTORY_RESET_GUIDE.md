# Factory Reset Guide

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## What is Factory Reset?
- Drops all tables, deletes all files (local/cloud), and resets the database
- Recreates schema and default data (companies, admin user)

## When to Use
- For a clean start (dev/testing)
- Before production migration (if no data)
- After major schema changes

## How to Run
1. Set `FACTORY_RESET=true` in `.env`
2. Start the server: `node server.js`
3. All data will be wiped and reset
4. Set `FACTORY_RESET=false` after reset

## Warning
- **All data will be lost!**
- Only use on empty or test environments

---
**Contact: Tran Minh Khoi, IT Department, Phat Dat Holdings** 