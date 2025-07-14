# Hướng dẫn Quản lý Thông tin Ràng buộc (Constraints)

## Tổng quan

Hệ thống constraints cho phép bạn định nghĩa các thông tin cố định và chính xác mà AI sẽ ưu tiên sử dụng khi trả lời câu hỏi. Điều này đảm bảo tính nhất quán và chính xác của thông tin quan trọng.

## Cấu trúc File constraints.json

```json
{
  "companies": {
    "PDH": {
      "fullName": "Phát Đạt Holdings",
      "parentGroup": "Phát Đạt Group",
      "chairman": "Nguyễn Văn Đạt",
      "ceo": "Dương Hồng Cẩm",
      "keywords": ["pdh", "phát đạt holdings", "phát đạt group"],
      "description": "Mô tả chi tiết về công ty"
    }
  },
  "keyPersons": {
    "Nguyễn Văn Đạt": {
      "position": "Chủ tịch Hội đồng Quản trị",
      "company": "Phát Đạt Holdings (PDH)",
      "group": "Phát Đạt Group"
    }
  },
  "commonQuestions": {
    "PDH là công ty gì": "Câu trả lời chuẩn",
    "PDH là gì": "Câu trả lời chuẩn khác"
  }
}
```

## API Endpoints

### 1. Xem tất cả constraints

```bash
GET /api/constraints
```

**Response:**
```json
{
  "success": true,
  "data": {
    "companies": {...},
    "keyPersons": {...},
    "commonQuestions": {...}
  }
}
```

### 2. Thêm/Cập nhật constraint

```bash
POST /api/constraints
Content-Type: application/json

{
  "question": "PDH là công ty gì",
  "answer": "PDH là Phát Đạt Holdings, công ty thuộc Phát Đạt Group..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Constraint added successfully",
  "data": {
    "question": "PDH là công ty gì",
    "answer": "PDH là Phát Đạt Holdings..."
  }
}
```

### 3. Xóa constraint

```bash
DELETE /api/constraints
Content-Type: application/json

{
  "question": "PDH là công ty gì"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Constraint removed successfully",
  "data": {
    "question": "PDH là công ty gì"
  }
}
```

## Ưu tiên Xử lý

Hệ thống xử lý câu hỏi theo thứ tự ưu tiên:

1. **Sensitive Content Check** - Kiểm tra nội dung nhạy cảm
2. **Constraints Check** - Kiểm tra thông tin ràng buộc ⭐ **ƯU TIÊN CAO**
3. **General Questions** - Câu hỏi chào hỏi, hệ thống
4. **Document-Specific Questions** - Câu hỏi về tài liệu
5. **General Chatbot** - Câu hỏi chung khác

## Cách thức Matching

### 1. Direct Match
- So sánh trực tiếp câu hỏi với các key trong `commonQuestions`

### 2. Fuzzy Match
- So sánh các từ khóa quan trọng
- Tối thiểu 2 từ khóa trùng khớp

### 3. Company Keywords
- Kiểm tra các từ khóa trong `companies.keywords[]`
- Tự động trả lời mô tả công ty khi phát hiện

## Ví dụ Sử dụng

### Thêm thông tin công ty mới

```bash
curl -X POST http://localhost:3000/api/constraints \
  -H "Content-Type: application/json" \
  -d '{
    "question": "ABC Corp là công ty gì",
    "answer": "ABC Corp là công ty công nghệ hàng đầu Việt Nam..."
  }'
```

### Cập nhật thông tin hiện tại

```bash
curl -X POST http://localhost:3000/api/constraints \
  -H "Content-Type: application/json" \
  -d '{
    "question": "PDH là công ty gì",
    "answer": "PDH là Phát Đạt Holdings với thông tin cập nhật mới..."
  }'
```

### Xóa thông tin không cần thiết

```bash
curl -X DELETE http://localhost:3000/api/constraints \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Câu hỏi cần xóa"
  }'
```

## Best Practices

1. **Sử dụng câu hỏi chuẩn** - Đặt câu hỏi theo format thường gặp
2. **Thông tin chính xác** - Đảm bảo câu trả lời được verify kỹ
3. **Cập nhật thường xuyên** - Review và update định kỳ
4. **Backup constraints** - Sao lưu file `constraints.json` thường xuyên

## Lưu ý Quan trọng

- ⚠️ Constraints có độ ưu tiên cao nhất, sẽ override cả thông tin từ documents
- 📝 File `constraints.json` được auto-save mỗi khi có thay đổi
- 🔄 Server tự động reload constraints sau khi thay đổi
- 🎯 Dùng cho thông tin cố định, ít thay đổi như thông tin công ty, nhân sự cấp cao

## Troubleshooting

### Constraint không hoạt động
1. Kiểm tra format JSON trong `constraints.json`
2. Restart server để reload constraints
3. Kiểm tra logs server để debug

### Lỗi API
- Đảm bảo Content-Type là `application/json`
- Kiểm tra required fields (question, answer)
- Kiểm tra server logs để debug chi tiết 