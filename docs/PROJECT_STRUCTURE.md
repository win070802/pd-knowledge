# 📁 Project Structure

## Tổng quan cấu trúc mới

Dự án đã được tái cấu trúc để tổ chức code và tài liệu một cách hợp lý hơn:

```
PD-Knowledge/
├── 📁 docs/                    # 📚 Documentation files
│   ├── API_GUIDE.md
│   ├── API_QUICK_REFERENCE.md
│   ├── AUTHENTICATION_GUIDE.md
│   ├── CONSTRAINTS_GUIDE.md
│   ├── DEPLOYMENT_GUIDE.md
│   ├── FACTORY_RESET_GUIDE.md
│   ├── PRODUCTION_DEPLOYMENT.md
│   ├── PRODUCTION_ISSUES.md
│   ├── PROJECT_STRUCTURE.md   # This file
│   ├── STORAGE_STRATEGY_COMPARISON.md
│   ├── SYSTEM_GUIDE.md
│   ├── VISION_API_SETUP_GUIDE.md
│   └── VISION_API_UPGRADE_SUMMARY.md
│
├── 📁 scripts/                 # 🔧 Scripts & Utilities
│   ├── examples.sh            # Usage examples
│   ├── factory-reset.js       # Factory reset functionality
│   ├── install-dependencies.sh
│   ├── migrate-production.js  # Database migration
│   ├── setup-production.js    # Production setup
│   ├── test-auth.js          # Authentication testing
│   └── test-vision-features.js
│
├── 📁 config/                  # ⚙️ Configuration files
│   ├── constraints.json       # AI constraints config
│   ├── nixpacks.toml         # Nixpacks deployment
│   └── railway.json          # Railway deployment
│
├── 📁 services/               # 🔌 Service modules
│   ├── gemini.js             # AI service
│   ├── ocr-service.js        # OCR functionality
│   ├── storage-service.js    # File storage
│   ├── vision-ocr-service.js # Vision OCR
│   └── vision-ocr-service-demo.js
│
├── 📁 data/                   # 💾 Data files
│   ├── eng.traineddata       # English OCR training
│   ├── vie.traineddata       # Vietnamese OCR training
│   ├── service-account-key.json
│   ├── vision-key.json
│   └── simple-pdh-info.txt
│
├── 📁 src/                    # 💻 Source code
│   ├── config/               # App configuration
│   ├── controllers/          # API controllers
│   ├── middleware/           # Express middleware
│   ├── models/              # Database models
│   ├── repositories/        # Data access layer
│   ├── routes/              # API routes
│   ├── services/            # Business logic
│   └── utils/               # Utility functions
│
├── 📁 temp/                   # 🗂️ Temporary files
├── 📁 temp-images/           # 🖼️ Temp image processing
├── 📁 uploads/               # 📤 Uploaded documents
│
├── 📄 server.js              # 🚀 Main application entry
├── 📄 database.js            # 🗄️ Database interface
├── 📄 package.json           # 📦 Dependencies
├── 📄 README.md              # 📖 Main documentation
├── 📄 Dockerfile             # 🐳 Container configuration
├── 📄 .gitignore             # 📝 Git ignore rules
└── 📄 .railwayignore         # 🚂 Railway ignore rules
```

---

## 🎯 Lợi ích của cấu trúc mới

### 1. **Documentation tập trung**
- Tất cả `.md` files trong thư mục `docs/`
- Dễ dàng tìm kiếm và quản lý tài liệu
- Tách biệt documentation với code

### 2. **Scripts có tổ chức**
- Tất cả scripts, tests, migration trong `scripts/`
- Dễ dàng chạy và maintain
- Không làm lộn xộn thư mục gốc

### 3. **Configuration rõ ràng**
- Config files tập trung trong `config/`
- Dễ dàng backup và version control
- Tách biệt config với code logic

### 4. **Services module hóa**
- Service files trong `services/`
- Dễ dàng import và reuse
- Cấu trúc rõ ràng cho business logic

### 5. **Data files an toàn**
- Training data, keys trong `data/`
- Có thể dễ dàng backup riêng
- Bảo mật tốt hơn cho sensitive files

---

## 🔄 Import Paths Updates

### Các import đã được cập nhật:

#### Controllers → Services
```javascript
// Trước
const geminiService = require('../../gemini');
const storageService = require('../../storage-service');

// Sau  
const geminiService = require('../../services/gemini');
const storageService = require('../../services/storage-service');
```

#### Scripts → Root files
```javascript
// Trước (trong scripts/)
const { db } = require('./database');
const { checkFactoryReset } = require('./factory-reset');

// Sau (từ scripts/)
const { db } = require('../database');
const { checkFactoryReset } = require('./scripts/factory-reset');
```

#### Config files
```javascript
// Trước
require.resolve('../../constraints.json')

// Sau
require.resolve('../../config/constraints.json')
```

#### Services → Root files
```javascript
// Trước (trong services/)
const { db } = require('./database');

// Sau (từ services/)
const { db } = require('../database');
```

---

## 🧪 Testing

### Kiểm tra imports hoạt động:
```bash
# Test authentication system
node scripts/test-auth.js

# Test vision features
node scripts/test-vision-features.js

# Start server để test imports
npm start
```

### Kiểm tra file paths:
```bash
# Kiểm tra config được load đúng
curl http://localhost:3000/api/constraints

# Kiểm tra services hoạt động
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Hello"}'
```

---

## 📋 Migration Checklist

- ✅ Di chuyển documentation files → `docs/`
- ✅ Di chuyển scripts → `scripts/`  
- ✅ Di chuyển config files → `config/`
- ✅ Di chuyển service modules → `services/`
- ✅ Di chuyển data files → `data/`
- ✅ Cập nhật import paths trong controllers
- ✅ Cập nhật import paths trong scripts
- ✅ Cập nhật import paths trong services
- ✅ Cập nhật server.js imports
- ✅ Test toàn bộ hệ thống

---

## 🚀 Kết quả

- **Thư mục gốc sạch sẽ**: Chỉ còn các file chính cần thiết
- **Tổ chức hợp lý**: Mỗi loại file có thư mục riêng
- **Dễ maintain**: Tìm file và quản lý code dễ dàng hơn
- **Scalable**: Dễ dàng thêm mới modules và documentation
- **Professional**: Cấu trúc chuẩn cho enterprise project

**🎉 Dự án đã được tái cấu trúc hoàn toàn!** 