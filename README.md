# PDF Knowledge Management System

Hệ thống quản lý kiến thức PDF với AI Gemini - Một giải pháp thông minh để lưu trữ, tìm kiếm và hỏi đáp về các tài liệu PDF của công ty.

## 🚀 Tính năng chính

### 📄 Core Features
- **Upload và xử lý PDF**: Tự động trích xuất văn bản từ file PDF
- **🔍 OCR Support**: Hỗ trợ đọc text từ PDF scan/hình ảnh bằng Tesseract OCR
- **Hỏi đáp thông minh**: Sử dụng AI Gemini để trả lời câu hỏi dựa trên nội dung tài liệu
- **Tìm kiếm tài liệu**: Tìm kiếm theo từ khóa trong nội dung tài liệu
- **🇻🇳 Hỗ trợ tiếng Việt**: OCR và AI đều hỗ trợ tiếng Việt

### 🆕 New AI-Powered Features
- **🧠 AI Text Correction**: Tự động sửa lỗi OCR bằng AI, cải thiện chất lượng text tiếng Việt
- **⚡ Smart Constraints**: Hệ thống trả lời nhanh cho câu hỏi thường gặp (35ms vs 2-10s)
- **🔄 Document Deduplication**: Tự động phát hiện và bỏ qua tài liệu trùng lặp
- **🎯 Intelligent Classification**: Phân loại câu hỏi document-specific vs general
- **🔍 Advanced Search**: Keyword extraction với relevance scoring

### 🏢 Enterprise Features  
- **Company Management**: Quản lý thông tin các công ty trong hệ thống
- **Knowledge Base**: Cơ sở tri thức riêng cho từng công ty
- **Sensitive Content Filter**: Phát hiện và chặn nội dung nhạy cảm
- **Debug Tools**: Công cụ phân tích search algorithm và document quality

### 📊 Management & Analytics
- **Tóm tắt tài liệu**: Tự động tóm tắt nội dung tài liệu
- **Lịch sử hỏi đáp**: Lưu trữ và xem lại các câu hỏi đã đặt  
- **Trích xuất thông tin**: Trích xuất thông tin quan trọng theo chủ đề
- **Performance Analytics**: Theo dõi response time và quality metrics

## 📋 Yêu cầu hệ thống

- Node.js >= 16.0.0
- PostgreSQL database
- Gemini API key
- **ImageMagick** (cho PDF-to-image conversion)
- **Tesseract OCR** (cho đọc text từ PDF scan)
- **Tesseract Vietnamese language pack** (cho OCR tiếng Việt)

## 🛠️ Cài đặt

### 1. Cài đặt system dependencies (OCR support)

```bash
# Chạy script tự động cài đặt
./install-dependencies.sh

# Hoặc cài đặt thủ công trên macOS:
brew install imagemagick tesseract tesseract-lang

# Hoặc cài đặt thủ công trên Ubuntu/Debian:
sudo apt update
sudo apt install -y imagemagick tesseract-ocr tesseract-ocr-vie
```

### 2. Cài đặt Node.js dependencies

```bash
npm install
```

### 3. Cấu hình môi trường

Tạo file `.env` trong thư mục gốc với nội dung ví dụ như sau:

```env
# Database Configuration
DATABASE_PUBLIC_URL=your_postgres_connection_url
POSTGRES_USER=your_postgres_user
POSTGRES_PASSWORD=your_postgres_password
PGPASSWORD=your_postgres_password

# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key

# Server Configuration
PORT=3000
NODE_ENV=development

# Upload Configuration
MAX_FILE_SIZE=10485760

# Google Cloud Storage Configuration
GOOGLE_CLOUD_PROJECT_ID=your_gcp_project_id
GOOGLE_CLOUD_KEY_FILE=./service-account-key.json         # (Chỉ dùng cho local dev)
GOOGLE_APPLICATION_CREDENTIALS_JSON=your_service_account_json_string  # (Dùng cho production, Railway)
GCS_BUCKET_NAME=your_gcs_bucket_name
```

**Lưu ý:**
- Không commit file `.env` thật lên git, chỉ dùng `.env.example` để tham khảo.
- Nếu deploy trên Railway, chỉ cần dùng `GOOGLE_APPLICATION_CREDENTIALS_JSON` (không cần file key).
- Nếu chạy local, dùng `GOOGLE_CLOUD_KEY_FILE` trỏ tới file key JSON đã tải về từ Google Cloud.
- `UPLOAD_PATH` không cần thiết nếu đã dùng cloud storage.

### 4. Khởi động server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## 📖 API Documentation

### 🔧 System APIs

#### 1. Health Check
```
GET /health
Response: { status: "OK", timestamp: "2024-..." }
```

### 📄 Document Management APIs

#### 2. Upload PDF Document
```
POST /api/upload
Content-Type: multipart/form-data
Body: document (file)

Response includes:
- id: Document ID
- filename: System filename
- originalName: Original filename
- filePath: File path on server
- fileSize: File size in bytes
- contentLength: Extracted text length
- processingMethod: "Standard" or "OCR"
- isScanned: true/false
- metadata: Additional processing info
```

#### 3. Get All Documents
```
GET /api/documents
Response: { success: true, documents: [...] }
```

#### 4. Get Document by ID
```
GET /api/documents/:id
Response: { success: true, document: {...} }
```

#### 5. Search Documents
```
GET /api/search?q=từ_khóa
Response: { success: true, documents: [...], searchTerm: "..." }
```

#### 6. Delete Document
```
DELETE /api/documents/:id
Response: { success: true, message: "Document deleted successfully" }
```

#### 7. **🆕 Reprocess Document with AI Text Correction**
```
POST /api/documents/:id/reprocess
Content-Type: application/json

Automatically corrects OCR errors using AI:
- Vietnamese diacritics: "BAN TAI CHIN" → "BAN TÀI CHÍNH"
- Company terms: "SƠ BO CHOC NANG" → "SƠ ĐỒ CHỨC NĂNG"
- Name corrections: "NGUYEN VO KHE" → "NGUYỄN VÕ KHE"

Response: { success: true, message: "Document reprocessed successfully" }
```

### 💬 Q&A and AI APIs

#### 8. Ask Question
```
POST /api/ask
Content-Type: application/json
Body: {
  "question": "Câu hỏi của bạn"
}

Features:
- Smart constraint checking
- Document-specific vs general questions
- AI-powered answers using Gemini
- Automatic document search and relevance scoring

Response: {
  success: true,
  question: "...",
  answer: "...",
  relevantDocuments: [...],
  responseTime: 1234
}
```

#### 9. Get Q&A History
```
GET /api/history?limit=50
Response: { success: true, questions: [...] }
```

#### 10. Summarize Document
```
POST /api/summarize/:id
Response: { success: true, summary: {...} }
```

#### 11. Extract Key Information
```
POST /api/extract
Content-Type: application/json
Body: {
  "searchTerm": "chủ đề cần trích xuất"
}
Response: { success: true, result: {...} }
```

### 🎯 Constraint Management APIs

#### 12. **🆕 Get All Constraints**
```
GET /api/constraints
Response: { success: true, data: {...} }
```

#### 13. **🆕 Add/Update Constraint**
```
POST /api/constraints
Content-Type: application/json
Body: {
  "question": "PDH là công ty gì?",
  "answer": "Phát Đạt Holdings"
}
Response: { success: true, message: "Constraint added successfully" }
```

#### 14. **🆕 Delete Constraint**
```
DELETE /api/constraints
Content-Type: application/json
Body: {
  "question": "Question to remove"
}
Response: { success: true, message: "Constraint removed successfully" }
```

### 🏢 Company Management APIs

#### 15. **🆕 Get All Companies**
```
GET /api/companies
Response: { success: true, data: [...] }
```

#### 16. **🆕 Get Company by Code**
```
GET /api/companies/:code
Response: { success: true, data: {...} }
```

#### 17. **🆕 Create Company**
```
POST /api/companies
Content-Type: application/json
Body: {
  "code": "PDH",
  "fullName": "Phát Đạt Holdings",
  "parentGroup": "Phát Đạt Group",
  "chairman": "Nguyễn Văn Đạt",
  "ceo": "Lê Văn Phát",
  "description": "Công ty...",
  "keywords": ["PDH", "Phát Đạt"]
}
Response: { success: true, data: {...} }
```

#### 18. **🆕 Update Company**
```
PUT /api/companies/:code
Content-Type: application/json
Body: { ... (company data) }
Response: { success: true, data: {...} }
```

#### 19. **🆕 Delete Company**
```
DELETE /api/companies/:code
Response: { success: true, message: "Company deleted successfully" }
```

### 🛡️ Sensitive Rules Management APIs

#### 20. **🆕 Get Sensitive Rules**
```
GET /api/sensitive-rules?active=true
Response: { success: true, data: [...] }
```

#### 21. **🆕 Create Sensitive Rule**
```
POST /api/sensitive-rules
Content-Type: application/json
Body: {
  "ruleName": "Violence Detection",
  "pattern": "súng|đạn|vũ khí|giết|bạo lực",
  "description": "Detect violent content",
  "isActive": true
}
Response: { success: true, data: {...} }
```

#### 22. **🆕 Update Sensitive Rule**
```
PUT /api/sensitive-rules/:id
Content-Type: application/json
Body: { ... (rule data) }
Response: { success: true, data: {...} }
```

#### 23. **🆕 Delete Sensitive Rule**
```
DELETE /api/sensitive-rules/:id
Response: { success: true, message: "Rule deleted successfully" }
```

### 🧠 Knowledge Base Management APIs

#### 24. **🆕 Get Knowledge by Company**
```
GET /api/knowledge/company/:companyId?active=true
Response: { success: true, data: [...] }
```

#### 25. **🆕 Search Knowledge Base**
```
GET /api/knowledge/search?q=search_term&company_id=1
Response: { success: true, data: [...] }
```

#### 26. **🆕 Create Knowledge Entry**
```
POST /api/knowledge
Content-Type: application/json
Body: {
  "companyId": 1,
  "question": "Quy trình...",
  "answer": "Trả lời...",
  "keywords": ["quy trình", "nghỉ phép"],
  "category": "HR",
  "isActive": true
}
Response: { success: true, data: {...} }
```

#### 27. **🆕 Update Knowledge Entry**
```
PUT /api/knowledge/:id
Content-Type: application/json
Body: { ... (knowledge data) }
Response: { success: true, data: {...} }
```

#### 28. **🆕 Delete Knowledge Entry**
```
DELETE /api/knowledge/:id
Response: { success: true, message: "Knowledge deleted successfully" }
```

### 🔍 Debug and Analysis APIs

#### 29. **🆕 Debug Search Algorithm**
```
POST /api/debug/search
Content-Type: application/json
Body: {
  "question": "Sơ đồ chức năng ban tài chính"
}

Features:
- Shows keyword extraction process
- Document relevance scoring details
- Deduplication information
- Performance metrics

Response: {
  success: true,
  query: "...",
  keywords: [...],
  results: [...]
}
```

#### 30. **🆕 Analyze Specific Document**
```
GET /api/debug/docs/:id

Provides detailed analysis:
- Content quality assessment
- Keyword density analysis
- OCR confidence scores (if applicable)
- Processing metadata

Response: {
  success: true,
  analysis: {
    contentLength: 1234,
    wordCount: 567,
    uniqueWords: 234,
    avgWordsPerSentence: 12.5,
    processingMethod: "OCR",
    confidence: 0.85
  }
}
```

## 🎯 Cách sử dụng

### 1. Upload tài liệu PDF

```bash
curl -X POST \
  http://localhost:3000/api/upload \
  -H 'Content-Type: multipart/form-data' \
  -F 'document=@/path/to/your/document.pdf'
```

### 2. Hỏi đáp về tài liệu

```bash
curl -X POST \
  http://localhost:3000/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "Quy trình xin phép nghỉ là gì?"}'
```

### 3. Tìm kiếm tài liệu

```bash
curl -X GET \
  "http://localhost:3000/api/search?q=quy định"
```

## 🏗️ Cấu trúc dự án

```
PD-Knowledge/
├── server.js                    # Server chính
├── database.js                  # Kết nối và thao tác database
├── gemini.js                    # Tích hợp AI Gemini
├── ocr-service.js               # Service OCR cho PDF scan
├── uploads/                     # Thư mục lưu trữ PDF
├── temp-images/                 # Thư mục tạm cho OCR
├── install-dependencies.sh      # Script cài đặt system dependencies
├── examples.sh                  # Ví dụ sử dụng API
├── package.json                 # Dependencies
├── .env                        # Cấu hình môi trường
└── README.md                   # Tài liệu hướng dẫn
```

## 🗃️ Database Schema

### Documents Table
- `id`: ID tự tăng
- `filename`: Tên file hệ thống
- `original_name`: Tên file gốc
- `file_path`: Đường dẫn file
- `file_size`: Kích thước file
- `content_text`: Nội dung văn bản
- `upload_date`: Ngày upload
- `processed`: Trạng thái xử lý
- `metadata`: Metadata JSON

### Questions Table
- `id`: ID tự tăng
- `question`: Câu hỏi
- `answer`: Câu trả lời
- `document_ids`: Mảng ID tài liệu liên quan
- `created_at`: Thời gian tạo
- `response_time`: Thời gian phản hồi

## 🔧 Cấu hình nâng cao

### Rate Limiting
- Giới hạn 100 requests/15 phút cho mỗi IP
- Có thể tùy chỉnh trong `server.js`

### File Upload
- Chỉ chấp nhận file PDF
- Giới hạn kích thước: 10MB (có thể tùy chỉnh)
- Lưu trữ tại thư mục `uploads/`

### Security
- Sử dụng helmet.js cho bảo mật header
- CORS enabled
- Input validation với Joi

## 🚨 Lỗi thường gặp

### 1. Không kết nối được database
- Kiểm tra lại thông tin DATABASE_PUBLIC_URL
- Đảm bảo PostgreSQL đang chạy

### 2. Lỗi Gemini API
- Kiểm tra GEMINI_API_KEY
- Đảm bảo API key còn hiệu lực

### 3. Lỗi upload file
- Kiểm tra thư mục uploads có quyền ghi
- Đảm bảo file là định dạng PDF

## 📚 Tài liệu chi tiết

### 📖 API Documentation Files
- **[API_GUIDE.md](./API_GUIDE.md)** - Hướng dẫn chi tiết tất cả API endpoints với examples và error handling
- **[API_QUICK_REFERENCE.md](./API_QUICK_REFERENCE.md)** - Bảng tra cứu nhanh tất cả APIs
- **[examples.sh](./examples.sh)** - Script demo tương tác với tất cả APIs

### 🚀 Cách sử dụng documentation
```bash
# Chạy tất cả API examples
./examples.sh

# Chạy examples cụ thể
./examples.sh qa debug          # Chỉ Q&A và debug APIs
./examples.sh constraints       # Chỉ constraint management

# Xem help
./examples.sh --help
```

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra logs server
2. Xem lại cấu hình .env
3. Đảm bảo tất cả dependencies đã được cài đặt
4. Tham khảo **[API_GUIDE.md](./API_GUIDE.md)** để biết chi tiết về error handling

## 🔍 OCR Processing

### PDF Scan Support
Hệ thống tự động phát hiện và xử lý PDF scan:

1. **Phát hiện PDF scan**: Nếu PDF có ít text (<100 ký tự)
2. **Chuyển đổi**: PDF → Images (JPG, 200 DPI)
3. **OCR**: Tesseract đọc text từ images
4. **Ngôn ngữ**: Hỗ trợ tiếng Việt + tiếng Anh
5. **Kết quả**: Text được trích xuất và lưu database

### OCR Performance
- **Chất lượng**: Tùy thuộc vào chất lượng scan
- **Thời gian**: 10-30 giây cho 1 tài liệu
- **Giới hạn**: Xử lý tối đa 10 trang đầu tiên
- **Cleanup**: Tự động xóa temp files

### Tips cho OCR tốt hơn
- Scan với DPI cao (>=300)
- Văn bản rõ ràng, không bị nhòe
- Tránh scan nghiêng
- Font chữ không quá nhỏ

## 🔮 Tính năng sắp tới

- [ ] Vector search cho tìm kiếm semantic
- [ ] Hỗ trợ nhiều định dạng file hơn
- [ ] Chat interface
- [ ] Phân quyền người dùng
- [ ] Export câu hỏi/trả lời
- [ ] Dashboard analytics
- [ ] OCR batch processing
- [ ] OCR quality optimization

---

**Lưu ý**: Hệ thống này được thiết kế để xử lý các tài liệu nội bộ công ty. Đảm bảo tuân thủ các quy định về bảo mật thông tin. 