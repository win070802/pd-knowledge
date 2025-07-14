# System Architecture Guide

## 🏗️ High-level Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │   Server    │    │  Database   │
│  (Web/API)  │◄──►│ (Node.js)   │◄──►│(PostgreSQL) │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │ Google Cloud│
                   │  Storage    │
                   └─────────────┘
```

## 📁 Project Structure

```
├── server.js                 # Main entry point
├── src/
│   ├── controllers/          # Business logic
│   ├── services/            # Core services
│   ├── repositories/        # Data access
│   ├── routes/             # API routing
│   └── middleware/         # Security & validation
├── storage-service.js       # File upload logic
├── gemini.js               # AI service wrapper
└── database.js             # DB connection
```

## ⚙️ Core Components

### 1. Document Processing Pipeline
```
PDF Upload → Company Detection → Category Assignment → 
OCR (if needed) → Cloud Storage → Database → AI Processing
```

### 2. Q&A Processing Flow
```
User Question → Knowledge Priority Check → Constraints Check → 
Document Search → AI Processing → Response
```

### 3. Company Management
- **5 Companies**: PDH, PDI, PDE, PDHH, RH
- **Auto-detection** from filename patterns
- **Folder structure**: `uploads/{Company}/{Category}/`

## 🔧 Key Services

### AI Service (`gemini.js`)
- **Question answering** via Google Gemini
- **Knowledge priority** for policy questions
- **Document listing** for regulation queries
- **Vietnamese language** support

### Storage Service (`storage-service.js`)
- **Google Cloud Storage** integration
- **Intelligent file organization**
- **Company/category detection**
- **OCR processing** for scanned PDFs

### Database Layer
- **PostgreSQL** with connection pooling
- **Repository pattern** for data access
- **Optimized queries** for search performance

## 📊 Data Flow

### Upload Flow
1. **Receive file** via multer middleware
2. **Detect company** from filename/content
3. **Assign category** (Quy định, Quy trình, etc.)
4. **Process content** (extract text or OCR)
5. **Upload to cloud** with structured path
6. **Save metadata** to database

### Q&A Flow
1. **Receive question**
2. **Check knowledge base** (if policy-related)
3. **Check constraints** (for quick answers)
4. **Search documents** (if needed)
5. **Generate AI response**
6. **Return with evidence**

## 🛡️ Security Features

- **Rate limiting**: 100 req/15min per IP
- **Input validation**: Joi schemas
- **File restrictions**: PDF only, 10MB max
- **CORS protection**: Configured domains
- **Helmet.js**: Security headers

## 📈 Performance Optimizations

### Response Times
- **Constraints**: 35-50ms (in-memory)
- **Knowledge base**: 200-500ms (cached)
- **Document search**: 100-300ms (indexed)
- **AI processing**: 500ms-3s (external API)

### Caching Strategy
- **In-memory constraints** for instant responses
- **Connection pooling** for database
- **Optimized search** with relevance scoring

## 🗄️ Database Schema

### Core Tables
```sql
-- Documents
documents (id, filename, company_id, category, content_text, ...)

-- Companies  
companies (id, code, full_name, keywords, ...)

-- Knowledge Base
knowledge_base (id, company_id, question, answer, keywords, ...)

-- Questions History
questions (id, question, answer, document_ids, response_time, ...)
```

## 🔄 Error Handling

### Upload Errors
- File too large → 413 error
- Invalid format → 400 error  
- Company not detected → Reject with message
- OCR failure → Fallback to standard extraction

### API Errors
- Rate limit exceeded → 429 error
- Invalid input → 400 with validation details
- Not found → 404 with helpful message
- Server error → 500 with safe error message

## 🚀 Deployment Architecture

### Development
```
Local Machine → Node.js Server → Local PostgreSQL
```

### Production  
```
Railway → Docker Container → Cloud PostgreSQL → Google Cloud Storage
```

### Environment Variables
```bash
DATABASE_PUBLIC_URL=...        # PostgreSQL connection
GEMINI_API_KEY=...            # Google AI API
GOOGLE_APPLICATION_CREDENTIALS_JSON=...  # GCS access
GCS_BUCKET_NAME=...           # Storage bucket
```

## 📊 Monitoring & Logging

### Built-in Logging
- **Request logging**: Morgan middleware
- **Processing time**: Response time tracking
- **Error tracking**: Console + structured logs
- **Debug mode**: Detailed search algorithm logs

### Health Monitoring
- **Health endpoint**: `/health`
- **Database connectivity**: Auto-checked on startup
- **Cloud storage**: Verified on first upload

---

**Architecture follows MVC pattern with clear separation of concerns for maintainability and scalability.** 