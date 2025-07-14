# PDF Knowledge Management System

## 🎯 Mục đích
Hệ thống quản lý kiến thức doanh nghiệp cho Tập đoàn Phát Đạt với AI tự động phân loại và trả lời câu hỏi.

## 🏢 Cấu trúc Tập đoàn
- **PDH** - Phát Đạt Holdings (công ty mẹ)
- **PDI** - Phát Đạt Industrial  
- **PDE** - Phát Đạt Energy
- **PDHH** - Phát Đạt Hospitality
- **RH** - Realty Holdings

## ⚡ Khởi động nhanh

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

### 3. Test API
```bash
# Upload file
curl -X POST http://localhost:3000/api/upload -F 'document=@file.pdf'

# Hỏi đáp
curl -X POST http://localhost:3000/api/ask -H 'Content-Type: application/json' -d '{"question": "Quy định nghỉ phép của PDH?"}'

# Dạy AI
curl -X POST http://localhost:3000/api/learn -H 'Content-Type: application/json' -d '{"question": "Chính sách nghỉ phép", "answer": "PDH nghỉ 12 buổi/năm"}'
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

## 🔧 API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/upload` | Upload PDF (field: `document`) |
| POST | `/api/ask` | Hỏi đáp với AI |
| POST | `/api/learn` | Dạy AI kiến thức mới |
| GET | `/api/search?q=term` | Tìm kiếm documents |
| GET | `/api/constraints` | Xem constraints |

## 📁 Cấu trúc project
```
├── server.js              # Main server
├── src/
│   ├── controllers/        # API controllers
│   ├── services/          # Business logic
│   ├── repositories/      # Database layer
│   └── routes/           # API routes
├── storage-service.js     # File upload logic
├── gemini.js             # AI service
└── database.js           # Database config
```

## 🛠️ Requirements
- Node.js 18+
- PostgreSQL
- Google Cloud Storage
- Tesseract OCR
- GraphicsMagick

---
**Enterprise PDF Knowledge Management** - Phát Đạt Holdings 