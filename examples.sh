#!/bin/bash

echo "📋 PDF Knowledge Management System - Usage Examples"
echo "=================================================="
echo ""

# Base URL
BASE_URL="http://localhost:3000"

echo "1. 🩺 Health Check"
echo "curl -X GET $BASE_URL/health"
curl -X GET "$BASE_URL/health"
echo ""
echo ""

echo "2. 📄 Get all documents"
echo "curl -X GET $BASE_URL/api/documents"
curl -X GET "$BASE_URL/api/documents"
echo ""
echo ""

echo "3. 📤 Upload PDF document (replace with your PDF file)"
echo "curl -X POST $BASE_URL/api/upload -F 'document=@/path/to/your/document.pdf'"
echo "# Example: curl -X POST $BASE_URL/api/upload -F 'document=@./sample.pdf'"
echo ""

echo "4. 💬 Ask a question"
echo "curl -X POST $BASE_URL/api/ask -H 'Content-Type: application/json' -d '{\"question\": \"Quy trình xin nghỉ phép như thế nào?\"}'"
curl -X POST "$BASE_URL/api/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "Xin chào, hệ thống có hoạt động không?"}'
echo ""
echo ""

echo "5. 🔍 Search documents"
echo "curl -X GET '$BASE_URL/api/search?q=quy%20định'"
curl -X GET "$BASE_URL/api/search?q=test"
echo ""
echo ""

echo "6. 📝 Get Q&A history"
echo "curl -X GET $BASE_URL/api/history?limit=5"
curl -X GET "$BASE_URL/api/history?limit=5"
echo ""
echo ""

echo "7. 📊 Summarize document (replace :id with actual document ID)"
echo "curl -X POST $BASE_URL/api/summarize/1"
echo "# This will work after you upload a document"
echo ""

echo "8. 🔎 Extract key information"
echo "curl -X POST $BASE_URL/api/extract -H 'Content-Type: application/json' -d '{\"searchTerm\": \"quy trình\"}'"
curl -X POST "$BASE_URL/api/extract" \
  -H "Content-Type: application/json" \
  -d '{"searchTerm": "quy trình"}'
echo ""
echo ""

echo "✅ Examples completed!"
echo ""
echo "📋 To get started:"
echo "1. Upload your PDF documents using example #3"
echo "2. Ask questions about your documents using example #4"
echo "3. Search for specific content using example #5"
echo ""
echo "🌐 Server: $BASE_URL"
echo "📚 Documentation: See README.md for detailed API documentation" 