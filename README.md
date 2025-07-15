# PDF Knowledge Management System

## 🎯 Mục đích
Hệ thống quản lý kiến thức doanh nghiệp cho Tập đoàn Phát Đạt với AI tự động phân loại và trả lời câu hỏi.

## 🏢 Cấu trúc Tập đoàn
- **PDH** - Phát Đạt Holdings (công ty mẹ)
- **PDI** - Phát Đạt Industrial  
- **PDE** - Phát Đạt Energy
- **PDHH** - Phát Đạt Hospitality
- **RH** - Realty Holdings

## ⚙️ Environment Variables

### Timeout Configuration
```bash
# Upload timeout (minutes) - for large file processing
UPLOAD_TIMEOUT_MINUTES=30          # Default: 20 minutes

# API timeout (minutes) - for regular requests  
API_TIMEOUT_MINUTES=15             # Default: 10 minutes

# Maximum file size
MAX_FILE_SIZE=150mb                # Default: 100mb
```

### Large File Handling
- **Dynamic timeout**: Automatically extends timeout based on file size
- **Smart processing**: Extra 1 minute per MB for files > 5MB
- **Maximum extension**: +10 minutes for very large files
- **Memory allocation**: 3GB RAM for heavy OCR processing

### Database & Storage
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Google Cloud Storage  
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'
GCS_BUCKET_NAME=your-bucket-name
```

## 🚀 Khởi động nhanh

### 1. Cài đặt
```bash
npm install
cp .env.example .env
# Cấu hình database và Google Cloud trong .env
```

### 2. Chạy server
```bash
export $(cat .env | grep -v '#' | xargs) && PORT=3000 node server.js
```

### 3. Đăng nhập Admin
```bash
# Đăng nhập để lấy token
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "admin", "password": "Admin@123123"}'

# Lưu token từ response để sử dụng cho các API cần quyền admin
```

### 4. Test API
```bash
# Hỏi đáp (public - không cần đăng nhập)
curl -X POST http://localhost:3000/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question": "Quy định nghỉ phép của PDH?"}'

# Upload file (cần admin - thêm Authorization header)
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F 'document=@file.pdf'

# Dạy AI (cần admin)
curl -X POST http://localhost:3000/api/learn \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"question": "Chính sách nghỉ phép", "answer": "PDH nghỉ 12 buổi/năm"}'
```

## 🚀 Tính năng chính

### 📄 Upload thông minh
- **Tự động detect company** từ filename (PDH-*, PDI-*, etc.)
- **Folder structure**: `uploads/{Company}/{Category}/`
- **Categories**: Quy định, Quy trình, Tài chính, Chính sách, etc.
- **OCR support** cho file scan

### 🤖 AI Q&A
- **Knowledge priority**: Ưu tiên kiến thức đã học cho policy questions
- **Document search**: Tìm kiếm trong tài liệu
- **Constraints**: Trả lời nhanh cho câu hỏi thường gặp
- **Evidence tracking**: Kèm nguồn tài liệu

### 📚 Learn API
- **Dạy AI** kiến thức mới qua text input
- **Company-specific** knowledge base
- **Vietnamese support** với keyword extraction

## 🔐 Authentication System

### Admin mặc định:
- **Username**: `admin`
- **Password**: `Admin@123123`
- **Thông tin**: Trần Minh Khôi, 0988204060, IT Hồ Chí Minh

### Phân quyền:
- **Public APIs**: Hỏi đáp, tìm kiếm (không cần đăng nhập)
- **Admin APIs**: Upload, delete, manage (cần đăng nhập admin)

📚 **Chi tiết**: Xem [AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md)

## 🔧 API Endpoints

| Method | Endpoint | Mô tả | Quyền |
|--------|----------|-------|-------|
| POST | `/api/auth/login` | Đăng nhập | Public |
| POST | `/api/ask` | Hỏi đáp với AI | Public |
| GET | `/api/search?q=term` | Tìm kiếm documents | Public |
| POST | `/api/upload` | Upload PDF | Admin |
| POST | `/api/learn` | Dạy AI kiến thức mới | Admin |
| DELETE | `/api/documents/:id` | Xóa tài liệu | Admin |
| GET | `/api/constraints` | Xem constraints | Public |

## 📁 Cấu trúc project
```
PD-Knowledge/
├── 📁 docs/              # Documentation files
├── 📁 scripts/           # Scripts, tests, migration
├── 📁 config/            # Configuration files
├── 📁 services/          # Service modules (AI, storage, OCR)
├── 📁 data/              # Data files, keys, training data
├── 📁 src/               # Source code
│   ├── controllers/      # API controllers
│   ├── middleware/       # Auth & security
│   ├── repositories/     # Database layer
│   └── routes/          # API routes
├── server.js            # Main application entry
└── database.js          # Database interface
```

📚 **Chi tiết**: Xem [docs/PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md)

## 🛠️ Requirements
- Node.js 18+
- PostgreSQL
- Google Cloud Storage
- Tesseract OCR
- GraphicsMagick

---
**Enterprise PDF Knowledge Management** - Phát Đạt Holdings 