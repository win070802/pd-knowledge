# PDF Knowledge Management System - Complete API Guide

Hướng dẫn chi tiết về tất cả các API endpoints của hệ thống quản lý kiến thức PDF với AI Gemini.

## 📋 Tổng quan

Base URL: `http://localhost:8080` (hoặc domain của bạn)

### 🔐 Authentication
Hiện tại hệ thống chưa có authentication. Tất cả APIs đều public access.

### 📊 Response Format
Tất cả APIs trả về JSON với format chuẩn:
```json
{
  "success": true,        // boolean: trạng thái thành công
  "data": {...},         // object/array: dữ liệu chính
  "message": "...",      // string: thông báo (optional)
  "error": "..."         // string: lỗi (nếu success = false)
}
```

### ⚡ Rate Limiting
- 100 requests / 15 phút cho mỗi IP
- Áp dụng cho tất cả `/api/*` endpoints

---

## 🔧 System APIs

### 1. Health Check
**Endpoint:** `GET /health`

**Mô tả:** Kiểm tra trạng thái hệ thống

**Example:**
```bash
curl http://localhost:8080/health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-07-14T12:00:00.000Z"
}
```

---

## 📄 Document Management APIs

### 2. Upload PDF Document
**Endpoint:** `POST /api/upload`

**Content-Type:** `multipart/form-data`

**Mô tả:** Upload và xử lý file PDF, tự động OCR nếu cần

**Parameters:**
- `document` (file): File PDF cần upload

**Features:**
- Tự động phát hiện PDF scan
- OCR tiếng Việt với Tesseract
- Upload lên cloud storage
- Trích xuất metadata

**Example:**
```bash
curl -X POST \
  http://localhost:8080/api/upload \
  -H 'Content-Type: multipart/form-data' \
  -F 'document=@/path/to/document.pdf'
```

**Response:**
```json
{
  "success": true,
  "document": {
    "id": 25,
    "filename": "document-1752497081987-32254989.pdf",
    "originalName": "SƠ ĐỒ CHỨC NĂNG BAN TÀI CHÍNH.pdf",
    "filePath": "uploads/general/document-1752497081987-32254989.pdf",
    "fileSize": 156789,
    "contentLength": 735,
    "processingMethod": "OCR",
    "isScanned": true,
    "metadata": {
      "uploadedAt": "2024-07-14T12:44:51.987Z",
      "contentLength": 735,
      "processingMethod": "OCR",
      "isScanned": true,
      "storageType": "cloud",
      "storageUrl": "https://storage.googleapis.com/..."
    }
  }
}
```

**Error Responses:**
```json
// No file uploaded
{
  "success": false,
  "error": "No file uploaded"
}

// File too large
{
  "success": false,
  "error": "File too large. Maximum size is 10MB"
}

// Invalid file type
{
  "success": false,
  "error": "Only PDF files are allowed"
}
```

### 3. Get All Documents
**Endpoint:** `GET /api/documents`

**Mô tả:** Lấy danh sách tất cả tài liệu

**Example:**
```bash
curl http://localhost:8080/api/documents
```

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": 25,
      "filename": "document-1752497081987-32254989.pdf",
      "original_name": "SƠ ĐỒ CHỨC NĂNG BAN TÀI CHÍNH.pdf",
      "file_path": "uploads/general/document-1752497081987-32254989.pdf",
      "file_size": 156789,
      "content_text": "CÔNG TY CỔ PHẦN PHÁT ĐẠT...",
      "upload_date": "2024-07-14T12:44:51.987Z",
      "processed": true,
      "metadata": {...}
    }
  ]
}
```

### 4. Get Document by ID
**Endpoint:** `GET /api/documents/:id`

**Mô tả:** Lấy thông tin chi tiết một tài liệu

**Parameters:**
- `id` (path): ID của tài liệu

**Example:**
```bash
curl http://localhost:8080/api/documents/25
```

**Response:**
```json
{
  "success": true,
  "document": {
    "id": 25,
    "filename": "document-1752497081987-32254989.pdf",
    "original_name": "SƠ ĐỒ CHỨC NĂNG BAN TÀI CHÍNH.pdf",
    "content_text": "CÔNG TY CỔ PHẦN PHÁT ĐẠT...",
    // ... other fields
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Document not found"
}
```

### 5. Search Documents
**Endpoint:** `GET /api/search`

**Mô tả:** Tìm kiếm tài liệu theo từ khóa

**Query Parameters:**
- `q` (string, required): Từ khóa tìm kiếm

**Example:**
```bash
curl "http://localhost:8080/api/search?q=ban%20tài%20chính"
```

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": 25,
      "original_name": "SƠ ĐỒ CHỨC NĂNG BAN TÀI CHÍNH.pdf",
      "content_text": "CÔNG TY CỔ PHẦN PHÁT ĐẠT...",
      "relevanceScore": 15
    }
  ],
  "searchTerm": "ban tài chính"
}
```

### 6. Delete Document
**Endpoint:** `DELETE /api/documents/:id`

**Mô tả:** Xóa tài liệu và file liên quan

**Parameters:**
- `id` (path): ID của tài liệu

**Example:**
```bash
curl -X DELETE http://localhost:8080/api/documents/25
```

**Response:**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

### 7. 🆕 Reprocess Document with AI Text Correction
**Endpoint:** `POST /api/documents/:id/reprocess`

**Mô tả:** Sử dụng AI để sửa lỗi OCR và cải thiện chất lượng text

**Parameters:**
- `id` (path): ID của tài liệu cần xử lý lại

**AI Corrections:**
- Vietnamese diacritics: `"BAN TAI CHIN"` → `"BAN TÀI CHÍNH"`
- Organization terms: `"SƠ BO CHOC NANG"` → `"SƠ ĐỒ CHỨC NĂNG"`
- Names: `"NGUYEN VO KHE"` → `"NGUYỄN VÕ KHE"`
- Company terms: `"PHAP CHE"` → `"PHÁP CHẾ"`

**Example:**
```bash
curl -X POST http://localhost:8080/api/documents/25/reprocess
```

**Response:**
```json
{
  "success": true,
  "message": "Document 25 reprocessed successfully",
  "details": {
    "originalLength": 735,
    "correctedLength": 757,
    "improvementRatio": 1.03
  }
}
```

---

## 💬 Q&A and AI APIs

### 8. Ask Question
**Endpoint:** `POST /api/ask`

**Content-Type:** `application/json`

**Mô tả:** Hỏi đáp thông minh sử dụng AI Gemini

**Body:**
```json
{
  "question": "Sơ đồ chức năng ban tài chính PDH có những gì?"
}
```

**Smart Features:**
- **Constraint checking**: Trả lời ngay lập tức cho câu hỏi đã được định nghĩa
- **Document classification**: Phân biệt câu hỏi về tài liệu vs câu hỏi chung
- **Intelligent search**: Tìm tài liệu liên quan với scoring algorithm
- **Deduplication**: Tránh tài liệu trùng lặp
- **Multi-language**: Hỗ trợ tiếng Việt và tiếng Anh

**Example:**
```bash
curl -X POST \
  http://localhost:8080/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "Ai là trưởng ban tài chính PDH?"}'
```

**Response:**
```json
{
  "success": true,
  "question": "Ai là trưởng ban tài chính PDH?",
  "answer": "Dựa trên sơ đồ chức năng ban tài chính PDH, trưởng ban tài chính là NGUYỄN VÕ KHE. Ban tài chính có cấu trúc tổ chức với các chức danh và nhiệm vụ được phân chia rõ ràng.",
  "relevantDocuments": [
    {
      "id": 25,
      "name": "SƠ ĐỒ CHỨC NĂNG BAN TÀI CHÍNH.pdf",
      "relevanceScore": 23
    }
  ],
  "responseTime": 2847
}
```

**Question Types:**

1. **Constraint Questions** (35ms response):
```bash
curl -X POST \
  http://localhost:8080/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "PDH là công ty gì?"}'
```

2. **Document-Specific Questions** (2-10s response):
```bash
curl -X POST \
  http://localhost:8080/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "Quy định nghỉ phép của công ty?"}'
```

3. **General Questions** (1-3s response):
```bash
curl -X POST \
  http://localhost:8080/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "Việt Nam có bao nhiêu tỉnh thành?"}'
```

### 9. Get Q&A History
**Endpoint:** `GET /api/history`

**Mô tả:** Lấy lịch sử câu hỏi và trả lời

**Query Parameters:**
- `limit` (number, optional): Số lượng câu hỏi (default: 50)

**Example:**
```bash
curl "http://localhost:8080/api/history?limit=10"
```

**Response:**
```json
{
  "success": true,
  "questions": [
    {
      "id": 123,
      "question": "PDH là công ty gì?",
      "answer": "Phát Đạt Holdings",
      "document_ids": [],
      "created_at": "2024-07-14T12:45:51.000Z",
      "response_time": 444
    }
  ]
}
```

### 10. Summarize Document
**Endpoint:** `POST /api/summarize/:id`

**Mô tả:** Tóm tắt nội dung tài liệu bằng AI

**Parameters:**
- `id` (path): ID của tài liệu cần tóm tắt

**Example:**
```bash
curl -X POST http://localhost:8080/api/summarize/25
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "summary": "Tài liệu này mô tả sơ đồ chức năng của Ban Tài chính công ty PDH, bao gồm:\n• Cấu trúc tổ chức với các vị trí chủ chốt\n• Phân công nhiệm vụ cụ thể\n• Quy trình báo cáo và quản lý tài chính",
    "documentName": "SƠ ĐỒ CHỨC NĂNG BAN TÀI CHÍNH.pdf",
    "documentId": 25
  }
}
```

### 11. Extract Key Information
**Endpoint:** `POST /api/extract`

**Content-Type:** `application/json`

**Mô tả:** Trích xuất thông tin quan trọng theo chủ đề

**Body:**
```json
{
  "searchTerm": "quy trình nghỉ phép"
}
```

**Example:**
```bash
curl -X POST \
  http://localhost:8080/api/extract \
  -H 'Content-Type: application/json' \
  -d '{"searchTerm": "ban tài chính"}'
```

**Response:**
```json
{
  "success": true,
  "result": {
    "info": "Thông tin về Ban Tài chính từ các tài liệu:\n\n1. **Cấu trúc tổ chức**: Ban Tài chính có trưởng ban là Nguyễn Võ Khe\n2. **Chức năng**: Quản lý tài chính, kế toán, báo cáo tài chính\n3. **Báo cáo**: Trực tiếp lên Ban Giám đốc",
    "documents": [
      {
        "id": 25,
        "name": "SƠ ĐỒ CHỨC NĂNG BAN TÀI CHÍNH.pdf",
        "uploadDate": "2024-07-14T12:44:51.987Z"
      }
    ]
  }
}
```

---

## 🎯 Constraint Management APIs

**Mô tả:** Quản lý các câu trả lời định sẵn cho câu hỏi thường gặp

### 12. Get All Constraints
**Endpoint:** `GET /api/constraints`

**Example:**
```bash
curl http://localhost:8080/api/constraints
```

**Response:**
```json
{
  "success": true,
  "data": {
    "commonQuestions": {
      "PDH là công ty gì?": "Phát Đạt Holdings",
      "hello": "Xin chào! Tôi là trợ lý AI..."
    },
    "companies": {
      "PDH": {
        "keywords": ["PDH", "Phát Đạt"],
        "description": "Phát Đạt Holdings"
      }
    }
  }
}
```

### 13. Add/Update Constraint
**Endpoint:** `POST /api/constraints`

**Content-Type:** `application/json`

**Body:**
```json
{
  "question": "PDH có bao nhiêu nhân viên?",
  "answer": "PDH hiện có khoảng 500 nhân viên"
}
```

**Example:**
```bash
curl -X POST \
  http://localhost:8080/api/constraints \
  -H 'Content-Type: application/json' \
  -d '{"question": "PDH có bao nhiêu nhân viên?", "answer": "PDH hiện có khoảng 500 nhân viên"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Constraint added successfully",
  "data": {
    "question": "PDH có bao nhiêu nhân viên?",
    "answer": "PDH hiện có khoảng 500 nhân viên"
  }
}
```

### 14. Delete Constraint
**Endpoint:** `DELETE /api/constraints`

**Content-Type:** `application/json`

**Body:**
```json
{
  "question": "PDH có bao nhiêu nhân viên?"
}
```

**Example:**
```bash
curl -X DELETE \
  http://localhost:8080/api/constraints \
  -H 'Content-Type: application/json' \
  -d '{"question": "PDH có bao nhiêu nhân viên?"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Constraint removed successfully",
  "data": {
    "question": "PDH có bao nhiêu nhân viên?"
  }
}
```

---

## 🏢 Company Management APIs

**Mô tả:** Quản lý thông tin các công ty trong hệ thống

### 15. Get All Companies
**Endpoint:** `GET /api/companies`

**Example:**
```bash
curl http://localhost:8080/api/companies
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "PDH",
      "full_name": "Phát Đạt Holdings",
      "parent_group": "Phát Đạt Group",
      "chairman": "Nguyễn Văn Đạt",
      "ceo": "Lê Văn Phát",
      "description": "Công ty cổ phần đầu tư và phát triển bất động sản",
      "keywords": ["PDH", "Phát Đạt", "Holdings"],
      "created_at": "2024-07-14T10:00:00.000Z"
    }
  ]
}
```

### 16. Get Company by Code
**Endpoint:** `GET /api/companies/:code`

**Parameters:**
- `code` (path): Mã công ty (VD: PDH)

**Example:**
```bash
curl http://localhost:8080/api/companies/PDH
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "PDH",
    "full_name": "Phát Đạt Holdings",
    "parent_group": "Phát Đạt Group",
    "chairman": "Nguyễn Văn Đạt",
    "ceo": "Lê Văn Phát",
    "description": "Công ty cổ phần đầu tư và phát triển bất động sản",
    "keywords": ["PDH", "Phát Đạt", "Holdings"],
    "created_at": "2024-07-14T10:00:00.000Z"
  }
}
```

### 17. Create Company
**Endpoint:** `POST /api/companies`

**Content-Type:** `application/json`

**Body:**
```json
{
  "code": "ABC",
  "fullName": "ABC Corporation",
  "parentGroup": "ABC Group",
  "chairman": "Nguyễn Văn A",
  "ceo": "Trần Văn B",
  "description": "Công ty ABC chuyên về...",
  "keywords": ["ABC", "Corporation"]
}
```

**Example:**
```bash
curl -X POST \
  http://localhost:8080/api/companies \
  -H 'Content-Type: application/json' \
  -d '{"code": "ABC", "fullName": "ABC Corporation", "description": "Công ty ABC"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Company created successfully",
  "data": {
    "id": 2,
    "code": "ABC",
    "full_name": "ABC Corporation",
    "description": "Công ty ABC",
    "created_at": "2024-07-14T13:00:00.000Z"
  }
}
```

### 18. Update Company
**Endpoint:** `PUT /api/companies/:code`

**Content-Type:** `application/json`

**Body:** (các field muốn update)
```json
{
  "fullName": "ABC Corporation Updated",
  "ceo": "Lê Văn C"
}
```

### 19. Delete Company
**Endpoint:** `DELETE /api/companies/:code`

**Example:**
```bash
curl -X DELETE http://localhost:8080/api/companies/ABC
```

---

## 🛡️ Sensitive Rules Management APIs

**Mô tả:** Quản lý các quy tắc phát hiện nội dung nhạy cảm

### 20. Get Sensitive Rules
**Endpoint:** `GET /api/sensitive-rules`

**Query Parameters:**
- `active` (boolean, optional): Chỉ lấy rule đang active (default: true)

**Example:**
```bash
curl "http://localhost:8080/api/sensitive-rules?active=true"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "rule_name": "Violence Detection",
      "pattern": "súng|đạn|vũ khí|giết|bạo lực|weapon|gun|kill|violence",
      "description": "Phát hiện nội dung bạo lực",
      "is_active": true,
      "created_at": "2024-07-14T10:00:00.000Z"
    }
  ]
}
```

### 21. Create Sensitive Rule
**Endpoint:** `POST /api/sensitive-rules`

**Content-Type:** `application/json`

**Body:**
```json
{
  "ruleName": "Adult Content Detection",
  "pattern": "sex|tình dục|khiêu dâm|porn|xxx|nude",
  "description": "Phát hiện nội dung người lớn",
  "isActive": true
}
```

**Example:**
```bash
curl -X POST \
  http://localhost:8080/api/sensitive-rules \
  -H 'Content-Type: application/json' \
  -d '{"ruleName": "Test Rule", "pattern": "test|thử nghiệm", "description": "Rule for testing"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Sensitive rule created successfully",
  "data": {
    "id": 2,
    "rule_name": "Test Rule",
    "pattern": "test|thử nghiệm",
    "description": "Rule for testing",
    "is_active": true,
    "created_at": "2024-07-14T13:00:00.000Z"
  }
}
```

### 22. Update Sensitive Rule
**Endpoint:** `PUT /api/sensitive-rules/:id`

### 23. Delete Sensitive Rule
**Endpoint:** `DELETE /api/sensitive-rules/:id`

---

## 🧠 Knowledge Base Management APIs

**Mô tả:** Quản lý cơ sở tri thức của từng công ty

### 24. Get Knowledge by Company
**Endpoint:** `GET /api/knowledge/company/:companyId`

**Parameters:**
- `companyId` (path): ID của công ty

**Query Parameters:**
- `active` (boolean, optional): Chỉ lấy entry đang active (default: true)

**Example:**
```bash
curl "http://localhost:8080/api/knowledge/company/1?active=true"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "company_id": 1,
      "question": "Quy trình xin nghỉ phép tại PDH?",
      "answer": "Nhân viên cần điền form xin nghỉ phép và gửi cho quản lý trực tiếp...",
      "keywords": ["nghỉ phép", "quy trình", "HR"],
      "category": "HR",
      "is_active": true,
      "created_at": "2024-07-14T10:00:00.000Z"
    }
  ]
}
```

### 25. Search Knowledge Base
**Endpoint:** `GET /api/knowledge/search`

**Query Parameters:**
- `q` (string, required): Từ khóa tìm kiếm
- `company_id` (number, optional): ID công ty để filter

**Example:**
```bash
curl "http://localhost:8080/api/knowledge/search?q=nghỉ%20phép&company_id=1"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "question": "Quy trình xin nghỉ phép tại PDH?",
      "answer": "Nhân viên cần điền form xin nghỉ phép...",
      "relevanceScore": 5,
      "company_name": "Phát Đạt Holdings"
    }
  ]
}
```

### 26. Create Knowledge Entry
**Endpoint:** `POST /api/knowledge`

**Content-Type:** `application/json`

**Body:**
```json
{
  "companyId": 1,
  "question": "Chính sách làm việc từ xa?",
  "answer": "PDH cho phép nhân viên làm việc từ xa tối đa 2 ngày/tuần...",
  "keywords": ["remote", "làm việc từ xa", "WFH"],
  "category": "HR",
  "isActive": true
}
```

**Example:**
```bash
curl -X POST \
  http://localhost:8080/api/knowledge \
  -H 'Content-Type: application/json' \
  -d '{"companyId": 1, "question": "Test knowledge", "answer": "Test answer"}'
```

### 27. Update Knowledge Entry
**Endpoint:** `PUT /api/knowledge/:id`

### 28. Delete Knowledge Entry
**Endpoint:** `DELETE /api/knowledge/:id`

---

## 🔍 Debug and Analysis APIs

**Mô tả:** APIs cho việc debug và phân tích hệ thống

### 29. Debug Search Algorithm
**Endpoint:** `POST /api/debug/search`

**Content-Type:** `application/json`

**Mô tả:** Phân tích chi tiết quá trình tìm kiếm để debug

**Body:**
```json
{
  "question": "Sơ đồ chức năng ban tài chính"
}
```

**Features:**
- Keyword extraction process
- Document relevance scoring
- Deduplication information
- Performance metrics

**Example:**
```bash
curl -X POST \
  http://localhost:8080/api/debug/search \
  -H 'Content-Type: application/json' \
  -d '{"question": "ban tài chính"}'
```

**Response:**
```json
{
  "success": true,
  "query": "ban tài chính",
  "keywords": ["ban", "tài", "chính"],
  "results": [
    {
      "id": 25,
      "original_name": "SƠ ĐỒ CHỨC NĂNG BAN TÀI CHÍNH.pdf",
      "relevanceScore": 23,
      "originalScore": 21,
      "keywordCount": 3,
      "matchDetails": {
        "ban": 5,
        "tài": 3,
        "chính": 2
      }
    }
  ],
  "totalDocuments": 26,
  "duplicatesSkipped": 22,
  "processingTime": 156
}
```

### 30. Analyze Specific Document
**Endpoint:** `GET /api/debug/docs/:id`

**Parameters:**
- `id` (path): ID của tài liệu cần phân tích

**Mô tả:** Phân tích chi tiết một tài liệu cụ thể

**Example:**
```bash
curl http://localhost:8080/api/debug/docs/25
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "documentId": 25,
    "originalName": "SƠ ĐỒ CHỨC NĂNG BAN TÀI CHÍNH.pdf",
    "contentLength": 463,
    "wordCount": 89,
    "uniqueWords": 67,
    "avgWordsPerSentence": 12.7,
    "processingMethod": "OCR",
    "ocrConfidence": 0.85,
    "languageDetected": "vi",
    "topKeywords": [
      {"word": "ban", "count": 5},
      {"word": "tài", "count": 3},
      {"word": "chính", "count": 2}
    ],
    "readabilityScore": 7.2,
    "lastProcessed": "2024-07-14T12:56:49.000Z"
  }
}
```

---

## 🔄 Workflow Examples

### Complete Document Upload and Q&A Workflow

```bash
# 1. Upload document
curl -X POST \
  http://localhost:8080/api/upload \
  -F 'document=@orgchart.pdf'

# 2. Wait for processing, then reprocess with AI correction
curl -X POST http://localhost:8080/api/documents/25/reprocess

# 3. Ask questions about the document
curl -X POST \
  http://localhost:8080/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "Ai là trưởng ban tài chính?"}'

# 4. Debug if needed
curl -X POST \
  http://localhost:8080/api/debug/search \
  -H 'Content-Type: application/json' \
  -d '{"question": "ban tài chính"}'
```

### Constraint Management Workflow

```bash
# 1. Add constraint
curl -X POST \
  http://localhost:8080/api/constraints \
  -H 'Content-Type: application/json' \
  -d '{"question": "PDH có bao nhiêu nhân viên?", "answer": "Khoảng 500 nhân viên"}'

# 2. Test constraint
curl -X POST \
  http://localhost:8080/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "PDH có bao nhiêu nhân viên?"}'

# 3. Update constraint if needed
curl -X POST \
  http://localhost:8080/api/constraints \
  -H 'Content-Type: application/json' \
  -d '{"question": "PDH có bao nhiêu nhân viên?", "answer": "Khoảng 600 nhân viên"}'
```

---

## ⚠️ Error Handling

### Common HTTP Status Codes

- `200 OK`: Thành công
- `400 Bad Request`: Lỗi input (thiếu parameter, invalid data)
- `404 Not Found`: Không tìm thấy resource
- `429 Too Many Requests`: Vượt quá rate limit
- `500 Internal Server Error`: Lỗi server

### Error Response Format

```json
{
  "success": false,
  "error": "Detailed error message",
  "code": "ERROR_CODE", // optional
  "details": {...}     // optional
}
```

### Common Errors

1. **Rate Limit Exceeded**
```json
{
  "success": false,
  "error": "Too many requests from this IP, please try again later."
}
```

2. **File Upload Errors**
```json
{
  "success": false,
  "error": "File too large. Maximum size is 10MB"
}
```

3. **Gemini API Errors**
```json
{
  "success": false,
  "error": "Có lỗi xảy ra khi xử lý câu hỏi. Vui lòng thử lại."
}
```

4. **Database Errors**
```json
{
  "success": false,
  "error": "Database connection failed"
}
```

---

## 🔐 Security Notes

1. **Input Validation**: Tất cả inputs đều được validate
2. **File Type Restriction**: Chỉ chấp nhận PDF files
3. **Rate Limiting**: 100 requests/15 phút mỗi IP
4. **Sensitive Content Filtering**: Tự động block nội dung nhạy cảm
5. **CORS Enabled**: Có thể gọi từ web frontend

---

## 📊 Performance Tips

1. **Constraint Usage**: Sử dụng constraints cho câu hỏi thường gặp (35ms vs 2-10s)
2. **Document Quality**: Upload PDF chất lượng cao để OCR tốt hơn
3. **AI Reprocessing**: Sử dụng reprocessing để cải thiện chất lượng text
4. **Caching**: Hệ thống tự động cache kết quả search
5. **Deduplication**: Tự động skip documents trùng lặp

---

## 🚀 Integration Examples

### JavaScript/Node.js Client

```javascript
const axios = require('axios');

class PDFKnowledgeClient {
  constructor(baseURL = 'http://localhost:8080') {
    this.baseURL = baseURL;
  }

  async uploadDocument(filePath) {
    const FormData = require('form-data');
    const fs = require('fs');
    
    const form = new FormData();
    form.append('document', fs.createReadStream(filePath));
    
    const response = await axios.post(`${this.baseURL}/api/upload`, form, {
      headers: form.getHeaders()
    });
    
    return response.data;
  }

  async askQuestion(question) {
    const response = await axios.post(`${this.baseURL}/api/ask`, {
      question
    });
    
    return response.data;
  }

  async reprocessDocument(documentId) {
    const response = await axios.post(`${this.baseURL}/api/documents/${documentId}/reprocess`);
    return response.data;
  }
}

// Usage
const client = new PDFKnowledgeClient();

async function main() {
  // Upload document
  const upload = await client.uploadDocument('./document.pdf');
  console.log('Document uploaded:', upload.document.id);
  
  // Reprocess with AI
  await client.reprocessDocument(upload.document.id);
  
  // Ask question
  const answer = await client.askQuestion('Tài liệu này nói về gì?');
  console.log('Answer:', answer.answer);
}
```

### Python Client

```python
import requests
import json

class PDFKnowledgeClient:
    def __init__(self, base_url="http://localhost:8080"):
        self.base_url = base_url
    
    def upload_document(self, file_path):
        with open(file_path, 'rb') as f:
            files = {'document': f}
            response = requests.post(f"{self.base_url}/api/upload", files=files)
        return response.json()
    
    def ask_question(self, question):
        data = {"question": question}
        response = requests.post(f"{self.base_url}/api/ask", json=data)
        return response.json()
    
    def reprocess_document(self, document_id):
        response = requests.post(f"{self.base_url}/api/documents/{document_id}/reprocess")
        return response.json()

# Usage
client = PDFKnowledgeClient()

# Upload and process
upload_result = client.upload_document("./document.pdf")
document_id = upload_result["document"]["id"]

# Reprocess with AI
client.reprocess_document(document_id)

# Ask question
answer = client.ask_question("Tài liệu này nói về gì?")
print(f"Answer: {answer['answer']}")
```

---

*Tài liệu này được cập nhật cho phiên bản v2.0 của PDF Knowledge Management System với đầy đủ các tính năng AI text correction, constraint management, và debug tools.* 