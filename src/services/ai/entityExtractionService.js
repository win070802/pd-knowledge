const { GoogleGenerativeAI } = require('@google/generative-ai');

class EntityExtractionService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  // Extract structured entities from document text
  async extractEntities(text, filename, companyId) {
    try {
      const prompt = `
Phân tích văn bản sau và trích xuất các thông tin quan trọng theo format JSON:

FILENAME: ${filename}
COMPANY: ${companyId}

VĂN BẢN:
${text.substring(0, 3000)}

Hãy trích xuất:
1. PEOPLE: Tên người và chức vụ
2. DEPARTMENTS: Tên phòng ban 
3. POLICIES: Tên quy định, quy trình
4. DATES: Ngày tháng quan trọng
5. NUMBERS: Số liệu, con số quan trọng
6. COMPANIES: Tên công ty, tổ chức

Trả về JSON format:
{
  "people": [
    {
      "name": "Tên đầy đủ",
      "position": "Chức vụ",
      "department": "Phòng ban",
      "confidence": 0.0-1.0
    }
  ],
  "departments": [
    {
      "name": "Tên phòng ban",
      "type": "IT/HR/Finance/Legal/Operations",
      "confidence": 0.0-1.0
    }
  ],
  "policies": [
    {
      "name": "Tên quy định",
      "type": "quy_trinh/quy_dinh/chinh_sach/huong_dan",
      "confidence": 0.0-1.0
    }
  ],
  "dates": [
    {
      "date": "YYYY-MM-DD",
      "context": "Ngữ cảnh của ngày",
      "confidence": 0.0-1.0
    }
  ],
  "numbers": [
    {
      "value": "Giá trị số",
      "context": "Ngữ cảnh (lương, số nhân viên, etc)",
      "unit": "Đơn vị",
      "confidence": 0.0-1.0
    }
  ],
  "companies": [
    {
      "name": "Tên công ty",
      "relationship": "parent/subsidiary/partner",
      "confidence": 0.0-1.0
    }
  ]
}

CHÚ Ý:
- Chỉ trích xuất thông tin có confidence >= 0.7
- Chuẩn hóa tên người (viết hoa chữ cái đầu)
- Loại bỏ thông tin không chắc chắn
- Ưu tiên thông tin về nhân sự và cấu trúc tổ chức

Chỉ trả về JSON, không giải thích:`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text_response = response.text();
      
      console.log(`🔍 Entity extraction raw response:`, text_response.substring(0, 200));
      
      // Parse JSON response
      const jsonMatch = text_response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const entities = JSON.parse(jsonMatch[0]);
          console.log(`🔍 Extracted entities from ${filename}:`, entities);
          return entities;
        } catch (parseError) {
          console.error('❌ Entity extraction JSON parse error:', parseError);
        }
      }
      
      return this.getEmptyEntities();
      
    } catch (error) {
      console.error('❌ Error in entity extraction:', error);
      return this.getEmptyEntities();
    }
  }

  // Compare entities between documents to find conflicts and similarities
  async compareEntities(newEntities, existingEntities, documentNames) {
    try {
      const prompt = `
So sánh các entities được trích xuất từ các documents khác nhau để tìm conflicts và similarities:

DOCUMENT MỚI: ${documentNames.new}
ENTITIES MỚI:
${JSON.stringify(newEntities, null, 2)}

CÁC DOCUMENTS CÓ SẴN: ${documentNames.existing.join(', ')}
ENTITIES CÓ SẴN:
${JSON.stringify(existingEntities, null, 2)}

Phân tích và trả về JSON:
{
  "conflicts": [
    {
      "type": "people/departments/policies/etc",
      "field": "name/position/etc", 
      "newValue": "Giá trị mới",
      "existingValue": "Giá trị cũ",
      "confidence": 0.0-1.0,
      "recommendation": "use_new/use_existing/merge",
      "reason": "Lý do"
    }
  ],
  "similarities": [
    {
      "type": "people/departments/etc",
      "matchedEntities": ["Entity 1", "Entity 2"],
      "confidence": 0.0-1.0,
      "isExactMatch": true/false
    }
  ],
  "corrections": [
    {
      "type": "people/departments/etc",
      "originalText": "Text gốc có lỗi OCR",
      "correctedText": "Text đã sửa",
      "confidence": 0.0-1.0,
      "evidence": "Bằng chứng từ document khác"
    }
  ],
  "newEntities": [
    {
      "type": "people/departments/etc",
      "entity": {},
      "isUnique": true/false
    }
  ]
}

CHÚ Ý:
- Ưu tiên accuracy cao hơn completeness
- Xác định OCR errors thông qua context và frequency
- Merge conflicting information intelligently
- Đề xuất corrections có confidence >= 0.8

Chỉ trả về JSON:`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text_response = response.text();
      
      console.log(`🔄 Entity comparison raw response:`, text_response.substring(0, 200));
      
      const jsonMatch = text_response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const comparison = JSON.parse(jsonMatch[0]);
          console.log(`🔄 Entity comparison result:`, comparison);
          return comparison;
        } catch (parseError) {
          console.error('❌ Entity comparison JSON parse error:', parseError);
        }
      }
      
      return {
        conflicts: [],
        similarities: [],
        corrections: [],
        newEntities: []
      };
      
    } catch (error) {
      console.error('❌ Error in entity comparison:', error);
      return {
        conflicts: [],
        similarities: [],
        corrections: [],
        newEntities: []
      };
    }
  }

  // Generate standardized metadata from merged entities
  async generateStandardizedMetadata(mergedEntities, companyId, documents) {
    try {
      const prompt = `
Tạo standardized metadata từ entities đã được merge và validated:

COMPANY: ${companyId}
DOCUMENTS: ${documents.map(d => d.name).join(', ')}

MERGED ENTITIES:
${JSON.stringify(mergedEntities, null, 2)}

Tạo metadata chuẩn theo format:
{
  "companyProfile": {
    "name": "Tên công ty chính thức",
    "leadership": [
      {
        "name": "Tên chuẩn hóa",
        "position": "Chức vụ chuẩn",
        "department": "Phòng ban",
        "isActive": true/false
      }
    ],
    "departments": [
      {
        "name": "Tên phòng ban chuẩn",
        "type": "IT/HR/Finance/Legal/Operations",
        "headCount": number_or_null,
        "manager": "Tên trưởng phòng"
      }
    ],
    "policies": [
      {
        "name": "Tên quy định chuẩn",
        "type": "quy_trinh/quy_dinh/chinh_sach",
        "effectiveDate": "YYYY-MM-DD",
        "status": "active/draft/archived"
      }
    ]
  },
  "dataQuality": {
    "totalDocuments": number,
    "entitiesExtracted": number,
    "conflictsResolved": number,
    "confidenceScore": 0.0-1.0,
    "lastUpdated": "ISO_TIMESTAMP"
  },
  "crossReferences": [
    {
      "entity": "Tên entity",
      "appearances": [
        {
          "document": "Tên file",
          "context": "Ngữ cảnh xuất hiện",
          "confidence": 0.0-1.0
        }
      ]
    }
  ]
}

CHÚ Ý:
- Chuẩn hóa tên người (First Letter Uppercase)
- Loại bỏ duplicates và conflicts
- Ưu tiên thông tin có confidence cao
- Tạo cross-references để tracking

Chỉ trả về JSON:`;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text_response = response.text();
      
      console.log(`📊 Metadata generation raw response:`, text_response.substring(0, 200));
      
      const jsonMatch = text_response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const metadata = JSON.parse(jsonMatch[0]);
          metadata.dataQuality.lastUpdated = new Date().toISOString();
          console.log(`📊 Generated standardized metadata:`, metadata);
          return metadata;
        } catch (parseError) {
          console.error('❌ Metadata generation JSON parse error:', parseError);
        }
      }
      
      return this.getEmptyMetadata(companyId);
      
    } catch (error) {
      console.error('❌ Error in metadata generation:', error);
      return this.getEmptyMetadata(companyId);
    }
  }

  // Helper method to return empty entities structure
  getEmptyEntities() {
    return {
      people: [],
      departments: [],
      policies: [],
      dates: [],
      numbers: [],
      companies: []
    };
  }

  // Helper method to return empty metadata structure
  getEmptyMetadata(companyId) {
    return {
      companyProfile: {
        name: companyId || 'Unknown',
        leadership: [],
        departments: [],
        policies: []
      },
      dataQuality: {
        totalDocuments: 0,
        entitiesExtracted: 0,
        conflictsResolved: 0,
        confidenceScore: 0.0,
        lastUpdated: new Date().toISOString()
      },
      crossReferences: []
    };
  }
}

module.exports = EntityExtractionService; 