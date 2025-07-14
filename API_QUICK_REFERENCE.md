# PDF Knowledge Management - API Quick Reference

## 🚀 Endpoint Overview

| Category | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| **System** | GET | `/health` | Health check |
| **Documents** | POST | `/api/upload` | Upload PDF document |
| | GET | `/api/documents` | Get all documents |
| | GET | `/api/documents/:id` | Get document by ID |
| | DELETE | `/api/documents/:id` | Delete document |
| | POST | `/api/documents/:id/reprocess` | 🆕 AI text correction |
| | GET | `/api/search` | Search documents |
| **Q&A** | POST | `/api/ask` | Ask question (AI-powered) |
| | GET | `/api/history` | Get Q&A history |
| | POST | `/api/summarize/:id` | Summarize document |
| | POST | `/api/extract` | Extract key information |
| **Constraints** | GET | `/api/constraints` | 🆕 Get all constraints |
| | POST | `/api/constraints` | 🆕 Add constraint |
| | DELETE | `/api/constraints` | 🆕 Remove constraint |
| **Companies** | GET | `/api/companies` | 🆕 Get all companies |
| | GET | `/api/companies/:code` | 🆕 Get company by code |
| | POST | `/api/companies` | 🆕 Create company |
| | PUT | `/api/companies/:code` | 🆕 Update company |
| | DELETE | `/api/companies/:code` | 🆕 Delete company |
| **Sensitive Rules** | GET | `/api/sensitive-rules` | 🆕 Get sensitive rules |
| | POST | `/api/sensitive-rules` | 🆕 Create rule |
| | PUT | `/api/sensitive-rules/:id` | 🆕 Update rule |
| | DELETE | `/api/sensitive-rules/:id` | 🆕 Delete rule |
| **Knowledge Base** | GET | `/api/knowledge/company/:id` | 🆕 Get company knowledge |
| | GET | `/api/knowledge/search` | 🆕 Search knowledge |
| | POST | `/api/knowledge` | 🆕 Create knowledge |
| | PUT | `/api/knowledge/:id` | 🆕 Update knowledge |
| | DELETE | `/api/knowledge/:id` | 🆕 Delete knowledge |
| **Debug** | POST | `/api/debug/search` | 🆕 Debug search algorithm |
| | GET | `/api/debug/docs/:id` | 🆕 Analyze document |

## 🔥 Most Used Endpoints

### 1. Upload & Process Document
```bash
# Upload
curl -X POST http://localhost:8080/api/upload -F 'document=@file.pdf'

# AI text correction
curl -X POST http://localhost:8080/api/documents/25/reprocess
```

### 2. Ask Questions
```bash
# Smart Q&A with AI
curl -X POST http://localhost:8080/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "PDH là công ty gì?"}'
```

### 3. Manage Constraints
```bash
# Add quick answer
curl -X POST http://localhost:8080/api/constraints \
  -H 'Content-Type: application/json' \
  -d '{"question": "PDH là gì?", "answer": "Phát Đạt Holdings"}'
```

### 4. Debug Search
```bash
# Debug search algorithm
curl -X POST http://localhost:8080/api/debug/search \
  -H 'Content-Type: application/json' \
  -d '{"question": "ban tài chính"}'
```

## ⚡ Response Times

| Endpoint Type | Typical Response Time |
|---------------|----------------------|
| Constraints | 35-50ms |
| Document search | 100-500ms |
| AI Q&A (simple) | 1-3s |
| AI Q&A (complex) | 2-10s |
| OCR processing | 10-30s |
| AI text correction | 3-10s |

## 🎯 Key Features

- **🔍 Smart Search**: Keyword extraction + relevance scoring
- **🧠 AI Text Correction**: Vietnamese diacritics + OCR fixes
- **⚡ Constraint System**: Instant answers for common questions
- **🔄 Deduplication**: Automatic duplicate document detection
- **🛡️ Content Filtering**: Sensitive content detection
- **📊 Debug Tools**: Search algorithm analysis

## 🔧 Common Workflows

### Complete Document Workflow
1. Upload → `/api/upload`
2. AI Correction → `/api/documents/:id/reprocess`
3. Ask Questions → `/api/ask`
4. Debug if needed → `/api/debug/search`

### Constraint Management
1. Add → `/api/constraints` (POST)
2. Test → `/api/ask`
3. Update → `/api/constraints` (POST again)
4. Remove → `/api/constraints` (DELETE)

---
*Xem API_GUIDE.md để có hướng dẫn chi tiết với examples và error handling* 