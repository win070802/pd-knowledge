# API Quick Reference

## 📋 Core APIs

| Method | Endpoint | Description | Body/Params |
|--------|----------|-------------|-------------|
| `POST` | `/api/upload` | Upload PDF | `document` (file) |
| `POST` | `/api/ask` | Ask question | `{"question": "..."}` |
| `POST` | `/api/learn` | Teach AI | `{"question": "...", "answer": "..."}` |
| `GET` | `/api/search` | Search docs | `?q=search_term` |
| `GET` | `/health` | Health check | - |

## 📄 Document Management

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/api/documents` | List all documents | Document array |
| `GET` | `/api/documents/:id` | Get document by ID | Document object |
| `DELETE` | `/api/documents/:id` | Delete document | Success message |
| `GET` | `/api/history` | Q&A history | `?limit=10` |

## 🏢 Company Management

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `GET` | `/api/companies` | List companies | - |
| `GET` | `/api/companies/:code` | Get company | - |
| `POST` | `/api/companies` | Create company | Company object |
| `PUT` | `/api/companies/:code` | Update company | Company object |
| `DELETE` | `/api/companies/:code` | Delete company | - |

## ⚙️ System Management

| Method | Endpoint | Description | Purpose |
|--------|----------|-------------|---------|
| `GET` | `/api/constraints` | Get business rules | Fast answers |
| `POST` | `/api/constraints` | Add/update rule | Custom responses |
| `DELETE` | `/api/constraints` | Remove rule | Rule cleanup |

## 🧠 Knowledge Base

| Method | Endpoint | Description | Usage |
|--------|----------|-------------|-------|
| `GET` | `/api/learn` | Get all knowledge | View learned data |
| `POST` | `/api/learn` | Add knowledge | Teach AI new facts |
| `GET` | `/api/knowledge/search` | Search knowledge | `?q=term&company_id=1` |

## 📊 Quick Examples

### Upload & Ask
```bash
# 1. Upload
curl -X POST http://localhost:3000/api/upload -F 'document=@file.pdf'

# 2. Ask about it
curl -X POST http://localhost:3000/api/ask -H 'Content-Type: application/json' \
  -d '{"question": "What is this document about?"}'
```

### Teach & Test
```bash
# 1. Teach
curl -X POST http://localhost:3000/api/learn -H 'Content-Type: application/json' \
  -d '{"question": "Company policy", "answer": "12 days vacation per year"}'

# 2. Test
curl -X POST http://localhost:3000/api/ask -H 'Content-Type: application/json' \
  -d '{"question": "How many vacation days?"}'
```

## 🚨 HTTP Status Codes

| Code | Meaning | Common Cases |
|------|---------|--------------|
| `200` | OK | Successful operation |
| `400` | Bad Request | Invalid input data |
| `404` | Not Found | Document/company not found |
| `413` | Payload Too Large | File > 10MB |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Server Error | Processing failed |

## 🔧 Response Format

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

---

**Note**: All POST requests use `Content-Type: application/json` unless specified otherwise. 