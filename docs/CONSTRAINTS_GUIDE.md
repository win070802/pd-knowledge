# Constraints System Guide

## 🎯 What are Constraints?

**Constraints** are pre-defined question-answer pairs that provide instant responses (35-50ms) for common questions, bypassing AI processing.

## ⚡ Why Use Constraints?

| Scenario | Without Constraints | With Constraints |
|----------|-------------------|------------------|
| "PDH là gì?" | 2-5s AI processing | 35ms instant response |
| "Các công ty trong tập đoàn?" | Search + AI | Immediate detailed answer |
| Common policies | Variable accuracy | Consistent, verified answers |

## 🔧 How It Works

```
User Question → Constraint Check → Direct Answer (if match)
              ↓
         No Match → Continue to AI processing
```

## 📝 Managing Constraints

### View Current Constraints
```bash
curl -X GET http://localhost:3000/api/constraints
```

### Add New Constraint
```bash
curl -X POST http://localhost:3000/api/constraints \
  -H 'Content-Type: application/json' \
  -d '{
    "question": "PDH nghỉ phép bao nhiêu ngày?",
    "answer": "PDH có 12 buổi nghỉ phép mỗi năm, mỗi tháng 1 buổi"
  }'
```

### Remove Constraint
```bash
curl -X DELETE http://localhost:3000/api/constraints \
  -H 'Content-Type: application/json' \
  -d '{
    "question": "Question to remove"
  }'
```

## 💡 Best Practices

### Good Constraint Examples
```json
{
  "question": "PDH là công ty gì?",
  "answer": "Phát Đạt Holdings - công ty mẹ của Tập đoàn Phát Đạt"
}

{
  "question": "Các công ty trong tập đoàn Phát Đạt",
  "answer": "PDH (Phát Đạt Holdings), PDI (Phát Đạt Industrial), PDE (Phát Đạt Energy), PDHOS (Phát Đạt Hospitality), RHS (Realty Holdings)"
}
```

### What to Include
- **Company information**: Names, roles, structure
- **Common policies**: Leave, working hours, procedures
- **Frequently asked questions**: Repeated questions from users
- **Emergency contacts**: Important phone numbers, emails

### What NOT to Include
- **Complex procedures**: Better handled by document search
- **Detailed regulations**: Should reference actual documents
- **Temporary information**: Dates, events, changing policies

## 🔍 Constraint Matching

### How Matching Works
- **Exact phrase matching** (case-insensitive)
- **Keyword overlap** detection
- **Vietnamese diacritics** normalized automatically

### Example Matches
```
Question: "PDH là gì?"
Matches: "PDH là công ty gì?"

Question: "công ty nào trong tập đoàn"
Matches: "Các công ty trong tập đoàn Phát Đạt"
```

## 📊 Current Default Constraints

### Company Structure
```
Q: "Các công ty trong tập đoàn Phát Đạt"
A: "PDH (Phát Đạt Holdings) - công ty mẹ
   PDI (Phát Đạt Industrial) - sản xuất công nghiệp
   PDE (Phát Đạt Energy) - năng lượng
   PDHOS (Phát Đạt Hospitality) - khách sạn du lịch  
   RHS (Realty Holdings) - bất động sản"
```

### Company Information
```
Q: "PDH là công ty gì?"
A: "Phát Đạt Holdings - công ty mẹ của Tập đoàn Phát Đạt"

Q: "PDI làm gì?"
A: "Phát Đạt Industrial - chuyên về sản xuất công nghiệp"
```

## 🛠️ Configuration

### File Location
Constraints are stored in `constraints.json` and loaded into memory on startup.

### Auto-reload
Server automatically reloads constraints when the file changes.

### Performance Impact
- **Memory usage**: ~1KB per 100 constraints
- **Response time**: 35-50ms (vs 2-10s for AI)
- **No external API calls** required

## 🔄 Integration with Q&A Flow

### Priority Order
1. **Constraints check** (instant)
2. **Knowledge base** (for policies)  
3. **Document search** (full AI processing)

### When Constraints Trigger
- **Exact question match** found
- **High keyword overlap** detected
- **No specific document** mentioned in question

## 📈 Analytics & Monitoring

### Track Constraint Usage
Check logs for constraint hits:
```bash
# Look for this pattern in logs
"✅ Using constraint answer"
```

### Performance Metrics
- Average constraint response time: 35-50ms
- Cache hit rate: 100% (in-memory)
- No external dependencies

---

**Constraints provide instant, consistent answers for common questions while preserving AI processing for complex document-specific queries.** 