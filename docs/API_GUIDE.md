# API Quick Guide

## 🚀 Base URL
```
http://localhost:3000
```

## 📄 Upload API

### Upload PDF
```bash
POST /api/upload
Content-Type: multipart/form-data
Field: document

# Example
curl -X POST http://localhost:3000/api/upload \
  -F 'document=@PDH-QT01-QuyTrinhThanhToan.pdf'
```

**Response:**
```json
{
  "success": true,
  "id": 123,
  "filename": "document-123.pdf",
  "company": "PDH",
  "category": "Quy trình",
  "cloudPath": "uploads/PDH/Quy_trinh/",
  "fileSize": 1024567,
  "contentLength": 5000,
  "processingMethod": "Standard"
}
```

## 🤖 Q&A API

### Ask Question
```bash
POST /api/ask
Content-Type: application/json

# Example
curl -X POST http://localhost:3000/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "Quy trình thanh toán của PDH là gì?"}'
```

**Response:**
```json
{
  "success": true,
  "question": "Quy trình thanh toán của PDH là gì?",
  "answer": "Theo tài liệu PDH-QT01...",
  "relevantDocuments": ["doc1.pdf", "doc2.pdf"],
  "responseTime": 1234,
  "source": "documents"
}
```

### Get Q&A History
```bash
GET /api/history?limit=10

# Response
{
  "success": true,
  "questions": [...]
}
```

## 📚 Learn API

### Thêm kiến thức mới từ văn bản
```bash
POST /api/learn
Content-Type: application/json

# Example
curl -X POST http://localhost:3000/api/learn \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Ban công nghệ thông tin PDH gồm có 4 người là Lê Nguyễn Hoàng Minh (CIO), Nguyễn Đức Doanh (quản lý hạ tầng), Trần Minh Khôi (IT), Nguyễn Quang Đợi (phần mềm)"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "AI successfully analyzed and added 8 knowledge entries autonomously",
  "analysis": {
    "detectedCompany": "PDH",
    "detectedCategory": "IT",
    "entriesGenerated": 8,
    "entriesUpdated": 0,
    "hasHistoricalUpdates": false
  },
  "knowledge": [
    {
      "id": 42,
      "company": "PDH",
      "question": "Ban công nghệ thông tin PDH có mấy người?",
      "answer": "Ban công nghệ thông tin PDH có 4 người.",
      "category": "IT",
      "keywordsCount": 6
    },
    {
      "id": 43,
      "company": "PDH",
      "question": "Ai là CIO của PDH?",
      "answer": "CIO của PDH là Lê Nguyễn Hoàng Minh.",
      "category": "IT",
      "keywordsCount": 6
    }
  ]
}
```

### Sửa/Cập nhật kiến thức từ văn bản
```bash
POST /api/learn/correct
Content-Type: application/json

# Example
curl -X POST http://localhost:3000/api/learn/correct \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Ban công nghệ thông tin PDH hiện có 5 người, gồm Lê Nguyễn Hoàng Minh (CIO), Nguyễn Đức Doanh, Trần Minh Khôi, Nguyễn Quang Đợi và Nguyễn Văn Hùng (mới vào ngày 15/7/2024)"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "AI successfully corrected 2 and added 5 knowledge entries",
  "analysis": {
    "detectedCompany": "PDH",
    "detectedCategory": "IT",
    "entriesGenerated": 7,
    "entriesUpdated": 2,
    "hasHistoricalUpdates": true
  },
  "knowledge": [
    {
      "id": 42,
      "company": "PDH",
      "question": "Ban công nghệ thông tin PDH có mấy người?",
      "answer": "Ban công nghệ thông tin PDH hiện có 5 người. Trước đây có 4 người.",
      "category": "IT",
      "keywordsCount": 6,
      "isHistoricalUpdate": true,
      "isUpdated": true
    }
  ],
  "historicalEntries": [
    {
      "id": 42,
      "previousAnswer": "Ban công nghệ thông tin PDH có 4 người.",
      "newAnswer": "Ban công nghệ thông tin PDH hiện có 5 người. Trước đây có 4 người."
    }
  ]
}
```

### Thêm kiến thức trực tiếp từ Q&A
```bash
POST /api/learn
Content-Type: application/json

# Example
curl -X POST http://localhost:3000/api/learn \
  -H 'Content-Type: application/json' \
  -d '{
    "question": "Chính sách nghỉ phép PDH",
    "answer": "PDH có 12 buổi nghỉ phép mỗi năm, 1 buổi mỗi tháng"
  }'
```

### Ánh xạ tài liệu vào công ty
```bash
POST /api/learn/document-company
Content-Type: application/json

# Example
curl -X POST http://localhost:3000/api/learn/document-company \
  -H 'Content-Type: application/json' \
  -d '{
    "documentId": 45,
    "companyCode": "PDH"
  }'
```

### Lấy kiến thức đã học
```bash
GET /api/learn?companyCode=PDH&category=IT

# Response
{
  "success": true,
  "count": 12,
  "knowledge": [
    {
      "id": 42,
      "company": "PDH",
      "question": "Ban công nghệ thông tin PDH có mấy người?",
      "answer": "Ban công nghệ thông tin PDH hiện có 5 người. Trước đây có 4 người.",
      "category": "IT",
      "keywords": ["ban", "công nghệ", "thông tin", "PDH", "người"],
      "metadata": {
        "entities": ["Ban công nghệ thông tin", "PDH"],
        "roles": [],
        "numerical_values": [{"type": "count", "value": 5, "unit": "người"}],
        "updatedAt": "2024-07-15T10:30:00.000Z",
        "previousValue": "Ban công nghệ thông tin PDH có 4 người."
      }
    }
  ]
}
```

## 🔍 Search API

### Search Documents
```bash
GET /api/search?q=quy%20trinh%20thanh%20toan

# Response
{
  "success": true,
  "documents": [
    {
      "id": 123,
      "original_name": "PDH-QT01-QuyTrinhThanhToan.pdf",
      "relevance_score": 0.95,
      "company": "PDH"
    }
  ],
  "searchTerm": "quy trinh thanh toan"
}
```

## ⚙️ System APIs

### Health Check
```bash
GET /health

# Response
{
  "status": "OK",
  "timestamp": "2024-07-14T16:00:00.000Z"
}
```

### Get Constraints
```bash
GET /api/constraints

# Response
{
  "success": true,
  "data": {
    "Các công ty trong tập đoàn Phát Đạt": "PDH (Phát Đạt Holdings)..."
  }
}
```

## 🏢 Companies API

### Get All Companies
```bash
GET /api/companies

# Response
{
  "success": true,
  "data": [
    {
      "code": "PDH",
      "full_name": "Phát Đạt Holdings",
      "keywords": ["PDH", "Phát Đạt"]
    }
  ]
}
```

## ❌ Error Responses

### Common Errors
```json
// File too large
{
  "success": false,
  "error": "File size exceeds 10MB limit"
}

// Company not detected
{
  "success": false,
  "error": "Cannot detect company from filename. Please declare new company."
}

// No documents found
{
  "success": false,
  "error": "No documents found for search term"
}
```

## 📊 Response Times

| Endpoint | Typical Response Time |
|----------|---------------------|
| `/api/upload` | 2-10s (depends on OCR) |
| `/api/ask` | 500ms-3s |
| `/api/learn` | 200-500ms |
| `/api/search` | 100-300ms |
| `/api/constraints` | 50-100ms |

## 🔧 Rate Limits

- **General**: 100 requests per 15 minutes per IP
- **Upload**: 10 files per hour per IP
- **Ask**: 50 questions per hour per IP

---

**Tip**: Use the `/health` endpoint to verify server status before making other API calls. 