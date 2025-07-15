# 🔐 Authentication System Guide

## Tổng quan

Hệ thống PD-Knowledge hiện đã được tích hợp với hệ thống đăng nhập và phân quyền để bảo vệ các chức năng quan trọng.

### 🎯 Phân loại quyền truy cập

#### Chức năng Public (Không cần đăng nhập)
- **Hỏi đáp AI**: `POST /api/ask` 
- **Tìm kiếm tài liệu**: `GET /api/search`
- **Xem danh sách công ty**: `GET /api/companies`
- **Xem knowledge base**: `GET /api/knowledge/search`
- **Xem constraints**: `GET /api/constraints`

#### Chức năng Admin (Cần đăng nhập)
- **Upload file**: `POST /api/upload`
- **Xóa tài liệu**: `DELETE /api/documents/:id`
- **Quản lý công ty**: `POST/PUT/DELETE /api/companies`
- **Quản lý knowledge**: `POST/PUT/DELETE /api/knowledge`
- **Dạy AI**: `POST /api/learn`
- **Debug**: Tất cả `/api/debug/*`
- **Factory reset**: `POST /api/debug/factory-reset`

---

## 👤 Tài khoản Admin mặc định

```
Username: admin
Password: Admin@123123
Thông tin: Trần Minh Khôi
          0988204060
          07/08/2002
          Nhân viên công nghệ thông tin
          Hồ Chí Minh, Việt Nam
```

---

## 🚀 Cách sử dụng

### 1. Đăng nhập

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin@123123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "username": "admin", 
      "fullName": "Trần Minh Khôi",
      "role": "admin",
      "phone": "0988204060",
      "position": "Nhân viên công nghệ thông tin",
      "location": "Hồ Chí Minh, Việt Nam"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  }
}
```

### 2. Sử dụng token cho các API cần quyền

```bash
# Upload file (cần admin)
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "document=@file.pdf"

# Xóa tài liệu (cần admin)  
curl -X DELETE http://localhost:3000/api/documents/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Dạy AI (cần admin)
curl -X POST http://localhost:3000/api/learn \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Chính sách nghỉ phép PDH?",
    "answer": "12 buổi/năm"
  }'
```

### 3. Quản lý profile

```bash
# Xem profile
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Cập nhật profile
curl -X PUT http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Trần Minh Khôi Updated",
    "phone": "0988204061"
  }'

# Đổi mật khẩu
curl -X PUT http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "Admin@123123",
    "newPassword": "NewPassword@123"
  }'
```

---

## 👥 Quản lý Users (Admin only)

### Tạo user mới
```bash
curl -X POST http://localhost:3000/api/auth/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "user2",
    "password": "Password@123",
    "fullName": "Nguyễn Văn B",
    "phone": "0987654321",
    "birthDate": "1990-01-01",
    "position": "Nhân viên",
    "location": "Hà Nội, Việt Nam"
  }'
```

### Xem danh sách users
```bash
curl -X GET http://localhost:3000/api/auth/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Vô hiệu hóa user
```bash
curl -X DELETE http://localhost:3000/api/auth/users/2 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🔒 Bảo mật

### JWT Token
- **Thời gian hết hạn**: 24 giờ
- **Secret key**: Cấu hình qua `JWT_SECRET` environment variable
- **Refresh**: Cần đăng nhập lại khi hết hạn

### Password
- **Mã hóa**: bcrypt với cost factor 10
- **Yêu cầu**: Mật khẩu mạnh khi tạo user mới
- **Đổi mật khẩu**: Yêu cầu mật khẩu cũ

### Environment Variables
```bash
# Tùy chọn (có default)
JWT_SECRET=your-super-secret-key-2024
JWT_EXPIRES_IN=24h
```

---

## 🚨 Lỗi thường gặp

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access token is required"
}
```
**Giải pháp**: Thêm header `Authorization: Bearer TOKEN`

### 403 Forbidden  
```json
{
  "success": false,
  "message": "Admin access required"
}
```
**Giải pháp**: Đăng nhập với tài khoản admin

### 401 Invalid token
```json
{
  "success": false, 
  "message": "Invalid or expired token"
}
```
**Giải pháp**: Đăng nhập lại để lấy token mới

---

## 📋 Checklist Migration

### Để áp dụng authentication:

1. ✅ **Database**: Bảng `users` đã được tạo tự động
2. ✅ **Admin user**: Tài khoản admin đã tồn tại
3. ✅ **Dependencies**: `bcrypt` và `jsonwebtoken` đã cài đặt
4. ✅ **Routes**: Đã bảo vệ các API cần thiết

### Test hoạt động:

```bash
# 1. Test đăng nhập
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@123123"}'

# 2. Test API public (vẫn hoạt động)
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Hello"}'

# 3. Test API protected (cần token)
# Sẽ trả về 401 nếu không có token
curl -X POST http://localhost:3000/api/upload
```

---

## 🔄 Workflow thực tế

### Cho Admin:
1. Đăng nhập lấy token
2. Sử dụng token cho mọi thao tác upload/delete/manage
3. Token hết hạn sau 24h → đăng nhập lại

### Cho User thường:
1. Không cần đăng nhập
2. Có thể hỏi đáp, tìm kiếm tài liệu bình thường
3. Không thể upload/delete/manage

---

**🛡️ Hệ thống đã sẵn sàng với bảo mật authentication!** 