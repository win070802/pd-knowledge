# API Quick Guide

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## Base URL
```
http://localhost:3000
```

## Main Endpoints

### Auth
- `POST /api/auth/login` — Login, returns JWT

### Companies
- `GET /api/companies` — List all companies
- `POST /api/companies` — Create company (admin)

### Documents
- `POST /api/upload` — Upload PDF (admin, field: `file`)
- `GET /api/documents` — List documents

### Q&A
- `POST /api/ask` — Ask a question (public)

### Learn
- `POST /api/learn` — Add knowledge (admin)
- `POST /api/learn/correct` — Update/correct knowledge (admin)
- `GET /api/learn` — List knowledge

## Example: Upload PDF
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer <JWT>" \
  -F "file=@document.pdf"
```

## Example: Ask Question
```bash
curl -X POST http://localhost:3000/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "What is the leave policy at PDH?"}'
```

## Example: Learn Knowledge
```bash
curl -X POST http://localhost:3000/api/learn \
  -H "Authorization: Bearer <JWT>" \
  -H 'Content-Type: application/json' \
  -d '{"question": "Leave policy", "answer": "12 days/year"}'
```

## Error Responses
- All errors return JSON:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Health Check
- `GET /health` — Returns 200 OK if server is running

---
**All APIs require valid JWT for admin actions.**

**Contact: Tran Minh Khoi, IT Department, Phat Dat Holdings** 