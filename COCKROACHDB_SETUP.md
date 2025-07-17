# Hướng dẫn thiết lập CockroachDB

## 1. Cài đặt trong môi trường local

### Thiết lập file .env
Mở file `.env` và cập nhật các thông tin kết nối CockroachDB:

```env
# Database Configuration
DATABASE_URL="postgresql://master:mật_khẩu_thực_tế@phatdat-knowledge-13384.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/phatdat-knowledge?sslmode=verify-full"
DATABASE_PUBLIC_URL="postgresql://master:mật_khẩu_thực_tế@phatdat-knowledge-13384.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/phatdat-knowledge?sslmode=verify-full"

# SSL Configuration
SSL_ENABLED=true
SSL_REJECT_UNAUTHORIZED=true
```

### Kiểm tra kết nối
```bash
node test-cockroach-connection.js
```

### Thiết lập cấu trúc database
```bash
node setup-cockroach-db.js
```

## 2. Cài đặt trên Railway

### Thiết lập biến môi trường Railway
Thêm các biến môi trường sau trong Railway:

- `DATABASE_URL`: URL kết nối CockroachDB
- `DATABASE_PUBLIC_URL`: URL kết nối CockroachDB (giống với DATABASE_URL)
- `SSL_ENABLED`: `true`
- `SSL_REJECT_UNAUTHORIZED`: `true`
- `NODE_ENV`: `production`

### Thiết lập cấu trúc database
Sau khi deploy lên Railway, bạn cần chạy script thiết lập database:

1. Kết nối SSH vào Railway:
```bash
railway shell
```

2. Chạy script thiết lập:
```bash
node setup-cockroach-db.js
```

## 3. Cấu hình SSL

- Trong môi trường **development** (local):
  - SSL có thể được cấu hình qua biến môi trường `SSL_ENABLED` và `SSL_REJECT_UNAUTHORIZED`
  - Mặc định, CockroachDB yêu cầu SSL với `verify-full`

- Trong môi trường **production** (Railway):
  - SSL luôn được bật (`SSL_ENABLED=true`)
  - Reject Unauthorized luôn được bật (`SSL_REJECT_UNAUTHORIZED=true`)

## 4. Tài khoản mặc định

Sau khi chạy script `setup-cockroach-db.js`, hệ thống sẽ tạo một tài khoản admin mặc định:

- **Username**: `admin`
- **Password**: `admin123`

## 5. Cấu trúc Database

Script thiết lập sẽ tạo các bảng sau:

- `users`: Thông tin người dùng
- `companies`: Thông tin công ty
- `departments`: Thông tin phòng ban
- `documents`: Tài liệu
- `knowledge`: Kiến thức
- `conversations`: Phiên hội thoại
- `conversation_messages`: Tin nhắn trong hội thoại
- `constraints`: Ràng buộc
- `questions`: Câu hỏi
- `sensitive_rules`: Quy tắc nhạy cảm 