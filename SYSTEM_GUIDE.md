# 📚 Hệ thống Quản lý Kiến thức Doanh nghiệp

## 🎯 Tổng quan

Hệ thống quản lý kiến thức thông minh cho nhiều công ty với khả năng:
- 📁 **Tổ chức file theo công ty** (PDH, PDI, ...)
- 🤖 **AI Q&A** với Gemini AI
- 🛡️ **Bảo mật nội dung** với rules có thể cấu hình
- 📊 **Knowledge base** thông minh
- ☁️ **Cloud storage** tự động

## 🏗️ Kiến trúc Hệ thống

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │   Backend API   │    │   PostgreSQL    │
│                 │    │                 │    │                 │
│ • Upload Files  │────│ • File Process  │────│ • Companies     │
│ • Q&A Interface │    │ • AI Integration│    │ • Knowledge     │
│ • Management    │    │ • Storage Mgmt  │    │ • Rules         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │ Google Cloud    │
                       │ Storage         │
                       │                 │
                       │ uploads/        │
                       │ ├── PDH/        │
                       │ ├── PDI/        │
                       │ └── general/    │
                       └─────────────────┘
```

## 🚀 Bắt đầu Nhanh

### 1. Cài đặt và Khởi tạo

```bash
# Clone và cài đặt dependencies
npm install

# Khởi tạo database và data mẫu
node init-data.js

# Khởi động server
npm start
```

### 2. Cấu hình Environment

```env
# Database
DATABASE_PUBLIC_URL=postgresql://username:password@host:port/database

# Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key
```

## 📋 API Documentation

### 🏢 Company Management

#### Get all companies
```bash
GET /api/companies
```

#### Get company by code
```bash
GET /api/companies/PDH
```

#### Create company
```bash
POST /api/companies
Content-Type: application/json

{
  "code": "PDH",
  "fullName": "Phát Đạt Holdings",
  "parentGroup": "Phát Đạt Group",
  "chairman": "Nguyễn Văn Đạt",
  "ceo": "Dương Hồng Cẩm",
  "description": "Mô tả công ty...",
  "keywords": ["pdh", "phát đạt holdings"]
}
```

#### Update company
```bash
PUT /api/companies/:id
```

#### Delete company
```bash
DELETE /api/companies/:id
```

### 🛡️ Sensitive Rules Management

#### Get all rules
```bash
GET /api/sensitive-rules?active=true
```

#### Create rule
```bash
POST /api/sensitive-rules
Content-Type: application/json

{
  "ruleName": "Violence Content",
  "pattern": "súng|đạn|vũ khí|weapon|gun",
  "description": "Chặn nội dung bạo lực",
  "isActive": true
}
```

#### Update rule
```bash
PUT /api/sensitive-rules/:id
```

#### Delete rule
```bash
DELETE /api/sensitive-rules/:id
```

### 📚 Knowledge Base Management

#### Get knowledge by company
```bash
GET /api/knowledge/company/:companyId?active=true
```

#### Search knowledge
```bash
GET /api/knowledge/search?q=search_term&company_id=1
```

#### Create knowledge entry
```bash
POST /api/knowledge
Content-Type: application/json

{
  "companyId": 1,
  "question": "PDH là công ty gì?",
  "answer": "PDH là Phát Đạt Holdings...",
  "keywords": ["pdh", "phát đạt"],
  "category": "Thông tin công ty",
  "isActive": true
}
```

#### Update knowledge
```bash
PUT /api/knowledge/:id
```

#### Delete knowledge
```bash
DELETE /api/knowledge/:id
```

### 📄 Document Management

#### Upload document
```bash
POST /api/upload
Content-Type: multipart/form-data

Form data:
- document: PDF file
- company: PDH (optional - auto-detect if not provided)
```

#### Get documents
```bash
GET /api/documents
```

#### Q&A with documents
```bash
POST /api/ask
Content-Type: application/json

{
  "question": "PDH là công ty gì?"
}
```

## 📁 File Organization

Hệ thống tự động tổ chức file theo company:

```
uploads/
├── PDH/                    # Phát Đạt Holdings
│   ├── quy-dinh-nhan-su.pdf
│   ├── quy-trinh-tai-chinh.pdf
│   └── ...
├── PDI/                    # Phát Đạt Industrials  
│   ├── quy-dinh-san-xuat.pdf
│   └── ...
└── general/                # Files không xác định được company
    └── ...
```

### Auto-detection Logic

1. **Filename detection**: Tìm company code trong tên file
2. **Content detection**: Scan nội dung PDF tìm company keywords
3. **Manual specification**: Chỉ định company khi upload

## 🔄 Workflow Xử lý Câu hỏi

```
User Question
     │
     ▼
🛡️ Sensitive Content Check (Database Rules)
     │
     ▼
🔒 Constraints Check (constraints.json)
     │
     ▼
💬 General Questions Check
     │
     ▼
📚 Knowledge Base Search (Priority: Database)
     │
     ▼
📄 Document Search
     │
     ▼
🤖 Gemini AI Processing
     │
     ▼
💾 Save Q&A History
     │
     ▼
📤 Return Response
```

## 🛠️ Management Features

### 1. Company Management
- ✅ CRUD operations cho companies
- ✅ Auto-detect company từ file/content
- ✅ Organize storage theo company folders

### 2. Content Security
- ✅ Database-driven sensitive rules
- ✅ Regex pattern validation
- ✅ Active/inactive rule management
- ✅ Real-time rule updates

### 3. Knowledge Base
- ✅ Company-specific knowledge entries
- ✅ Keyword-based search
- ✅ Category organization
- ✅ Priority over document search

### 4. File Storage
- ✅ Google Cloud Storage integration
- ✅ Local storage fallback
- ✅ Company folder organization
- ✅ Metadata tracking

## 🎯 Use Cases

### 1. Upload và Organize Documents
```bash
# Upload PDH document - tự động detect và lưu vào uploads/PDH/
curl -X POST http://localhost:8080/api/upload \
  -F "document=@quy-dinh-pdh.pdf"

# Upload với chỉ định company
curl -X POST http://localhost:8080/api/upload \
  -F "document=@document.pdf" \
  -F "company=PDI"
```

### 2. Thêm Knowledge Entry
```bash
# Thêm kiến thức về PDH
curl -X POST http://localhost:8080/api/knowledge \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": 1,
    "question": "Quy trình nghỉ phép PDH",
    "answer": "Nhân viên PDH cần làm đơn xin nghỉ phép...",
    "keywords": ["nghỉ phép", "quy trình"],
    "category": "Nhân sự"
  }'
```

### 3. Cấu hình Sensitive Rule
```bash
# Thêm rule chặn nội dung mới
curl -X POST http://localhost:8080/api/sensitive-rules \
  -H "Content-Type: application/json" \
  -d '{
    "ruleName": "Cryptocurrency",
    "pattern": "bitcoin|crypto|đào coin|tiền ảo",
    "description": "Chặn nội dung về tiền điện tử"
  }'
```

## 📊 Monitoring & Analytics

### Database Statistics
```bash
# Xem thống kê companies
curl http://localhost:8080/api/companies

# Xem rules đang active
curl http://localhost:8080/api/sensitive-rules?active=true

# Xem Q&A history
curl http://localhost:8080/api/history
```

### File Organization
```bash
# Check file uploads theo company
ls -la uploads/
ls -la uploads/PDH/
ls -la uploads/PDI/
```

## 🔧 Troubleshooting

### Database Issues
```bash
# Reinitialize database
node init-data.js

# Check database connection
psql $DATABASE_PUBLIC_URL -c "SELECT COUNT(*) FROM companies;"
```

### Storage Issues
```bash
# Check cloud storage credentials
echo $GOOGLE_APPLICATION_CREDENTIALS_JSON | jq .

# Test local storage fallback
mkdir -p uploads/test
```

### API Testing
```bash
# Health check
curl http://localhost:8080/health

# Test Q&A
curl -X POST http://localhost:8080/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "PDH là công ty gì?"}'
```

## 🚀 Advanced Features

### 1. Batch Operations
- Bulk upload documents
- Batch create knowledge entries
- Mass update company information

### 2. AI Enhancement
- Semantic search với vector embeddings
- Automatic content categorization
- Smart document summarization

### 3. Security & Compliance
- Audit logs cho sensitive content
- Role-based access control
- Document encryption

### 4. Integration
- Webhook notifications
- API rate limiting
- Multi-language support

## 📈 Performance Tips

1. **Database Optimization**
   - Index trên keywords columns
   - Regular vacuum và analyze
   - Connection pooling

2. **Storage Optimization**  
   - CDN cho file delivery
   - Compression cho large files
   - Lifecycle policies

3. **AI Optimization**
   - Cache frequently asked questions
   - Batch processing cho multiple queries
   - Model fine-tuning

## 🔮 Roadmap

- [ ] Vector search integration
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Mobile app
- [ ] Advanced document parsing (Word, Excel, etc.)
- [ ] Integration với enterprise systems (SharePoint, etc.)

---

🎉 **Hệ thống hoàn chỉnh và sẵn sàng triển khai!** 