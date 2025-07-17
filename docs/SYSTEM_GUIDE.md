# System Guide

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## Architecture Overview
- Node.js backend (Express)
- PostgreSQL/CockroachDB for storage
- Google Cloud Vision & Gemini AI for OCR and Q&A
- JWT authentication for admin APIs

## Main Modules
- **Auth:** Login, JWT, admin management
- **Documents:** Upload, OCR, metadata extraction
- **Knowledge:** Learn, update, and search knowledge
- **Q&A:** Smart question answering from documents and knowledge
- **Companies:** Manage company info
- **Constraints:** Pre-defined answers for common questions

## Data Flow
1. User uploads PDF → OCR → metadata extraction → store in DB/cloud
2. User/AI adds knowledge → stored in knowledge base
3. User asks question → system checks constraints, knowledge, then documents

## Integration
- All modules communicate via REST API
- All data stored in DB, files in cloud/local

---
**Contact: Tran Minh Khoi, IT Department, Phat Dat Holdings** 