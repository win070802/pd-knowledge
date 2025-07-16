# API Quick Reference

## 📋 Core APIs

| Method | Endpoint | Description | Body/Params |
|--------|----------|-------------|-------------|
| `POST` | `/api/upload` | Upload PDF | `document` (file) |
| `POST` | `/api/ask` | Ask question | `{"question": "..."}` |
| `POST` | `/api/learn` | Teach AI | `{"text": "..."} or {"question": "...", "answer": "..."}` |
| `POST` | `/api/learn/correct` | Correct knowledge | `{"text": "..."}` |
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
| `GET` | `/api/learn` | Get all knowledge | View learned data with `?companyCode=PDH&category=IT` |
| `POST` | `/api/learn` | Add knowledge from text | `{"text": "..."}` - AI auto-analyzes text |
| `POST` | `/api/learn` | Add knowledge from Q&A | `{"question": "...", "answer": "..."}` |
| `POST` | `/api/learn/correct` | Update/correct knowledge | `{"text": "..."}` - AI detects & updates existing entries |
| `POST` | `/api/learn/document-company` | Map document to company | `{"documentId": 123, "companyCode": "PDH"}` |
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
# 1. Teach new knowledge
curl -X POST http://localhost:3000/api/learn -H 'Content-Type: application/json' \
  -d '{"text": "Team IT PDH có 4 người: Minh, Doanh, Khôi, Đợi"}'

# 2. Correct knowledge when info changes
curl -X POST http://localhost:3000/api/learn/correct -H 'Content-Type: application/json' \
  -d '{"text": "Team IT PDH hiện có 5 người: Minh, Doanh, Khôi, Đợi và Hùng"}'

# 3. Test
curl -X POST http://localhost:3000/api/ask -H 'Content-Type: application/json' \
  -d '{"question": "Team IT PDH có mấy người và gồm những ai?"}'
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