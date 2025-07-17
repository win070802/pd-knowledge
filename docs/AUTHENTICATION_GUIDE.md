# Authentication Guide

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## Overview
- JWT-based authentication for all admin APIs
- Default admin: `admin` / `Admin@123123` (reset on every migration)
- Public APIs: Q&A, search, health check
- Admin APIs: Upload, learn, manage companies, etc.

## How It Works
- Login via `/api/auth/login` → receive JWT
- Use JWT in `Authorization: Bearer <token>` for all admin endpoints
- Token expires in 24h

## Security Tips
- Change admin password in production (set `ADMIN_PASSWORD` env)
- Never expose JWT or credentials publicly
- Use HTTPS in production

---
**Contact: Tran Minh Khoi, IT Department, Phat Dat Holdings** 