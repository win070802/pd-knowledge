# PDF Knowledge Management System

Hệ thống quản lý kiến thức PDF với AI Gemini - Một giải pháp thông minh để lưu trữ, tìm kiếm và hỏi đáp về các tài liệu PDF của công ty.

## 🚀 Tính năng chính

- **Upload và xử lý PDF**: Tự động trích xuất văn bản từ file PDF
- **🔍 OCR Support**: Hỗ trợ đọc text từ PDF scan/hình ảnh bằng Tesseract OCR
- **Hỏi đáp thông minh**: Sử dụng AI Gemini để trả lời câu hỏi dựa trên nội dung tài liệu
- **Tìm kiếm tài liệu**: Tìm kiếm theo từ khóa trong nội dung tài liệu
- **Tóm tắt tài liệu**: Tự động tóm tắt nội dung tài liệu
- **Lịch sử hỏi đáp**: Lưu trữ và xem lại các câu hỏi đã đặt
- **Trích xuất thông tin**: Trích xuất thông tin quan trọng theo chủ đề
- **🇻🇳 Hỗ trợ tiếng Việt**: OCR và AI đều hỗ trợ tiếng Việt

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

Tạo file `.env` trong thư mục gốc với nội dung:

```env
# Database Configuration
DATABASE_PUBLIC_URL=postgresql://postgres:LnWEFvBOCMBNeuZrVmbABkXcAIiijgdg@nozomi.proxy.rlwy.net:53493/railway
POSTGRES_USER=postgres
POSTGRES_PASSWORD=LnWEFvBOCMBNeuZrVmbABkXcAIiijgdg
PGPASSWORD=LnWEFvBOCMBNeuZrVmbABkXcAIiijgdg

# Gemini AI Configuration
GEMINI_API_KEY=AIzaSyCOWyP9vC31PVltexJUlinX-7wiU16LsJ0

# Server Configuration
PORT=3000
NODE_ENV=development

# Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

### 4. Khởi động server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server sẽ chạy tại: `http://localhost:3000`

## 📖 API Documentation

### 1. Health Check
```
GET /health
```

### 2. Upload PDF Document
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

### 3. Hỏi đáp
```
POST /api/ask
Content-Type: application/json
Body: {
  "question": "Câu hỏi của bạn"
}
```

### 4. Lấy danh sách tài liệu
```
GET /api/documents
```

### 5. Lấy thông tin tài liệu
```
GET /api/documents/:id
```

### 6. Tìm kiếm tài liệu
```
GET /api/search?q=từ_khóa
```

### 7. Tóm tắt tài liệu
```
POST /api/summarize/:id
```

### 8. Trích xuất thông tin
```
POST /api/extract
Content-Type: application/json
Body: {
  "searchTerm": "chủ đề cần trích xuất"
}
```

### 9. Lịch sử hỏi đáp
```
GET /api/history?limit=50
```

### 10. Xóa tài liệu
```
DELETE /api/documents/:id
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

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra logs server
2. Xem lại cấu hình .env
3. Đảm bảo tất cả dependencies đã được cài đặt

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