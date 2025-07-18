const { GoogleGenerativeAI } = require('@google/generative-ai');
const { db } = require('../../../database');

class GeminiAiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  // Phát hiện tham chiếu trong câu hỏi dựa trên AI
  async detectReferences(question, history = [], context = {}) {
    try {
      console.log(`🧠 Phân tích tham chiếu thông minh cho câu hỏi: "${question}"`);
      
      // Nếu không có lịch sử, không thể có tham chiếu
      if (!history || history.length <= 1) {
        console.log(`⚠️ Không có lịch sử hội thoại, không thể có tham chiếu`);
        return { 
          hasReference: false, 
          resolvedQuestion: question,
          confidence: 100
        };
      }

      // Xây dựng lịch sử hội thoại cho prompt
      let conversationHistory = '';
      // Chỉ lấy 5 tin nhắn gần nhất để tiết kiệm token
      const recentHistory = history.slice(-5);
      
      for (const msg of recentHistory) {
        const role = msg.message_type === 'question' ? 'Người dùng' : 'Trợ lý';
        conversationHistory += `${role}: ${msg.content}\n`;
        
        // Nếu là câu trả lời và có tài liệu liên quan, thêm thông tin
        if (msg.message_type === 'answer' && msg.relevant_documents && msg.relevant_documents.length > 0) {
          conversationHistory += `[Tài liệu đề cập: ${msg.relevant_documents.map(doc => doc.name || 'Không có tên').join(', ')}]\n`;
        }
      }

      // Tạo prompt cho phân tích tham chiếu
      const prompt = `Bạn là một hệ thống phân tích ngữ cảnh hội thoại chuyên nghiệp. Nhiệm vụ của bạn là phân tích xem câu hỏi hiện tại có chứa tham chiếu đến tài liệu hoặc thông tin từ các tin nhắn trước đó không.

LỊCH SỬ HỘI THOẠI GẦN ĐÂY:
${conversationHistory}

CÂU HỎI HIỆN TẠI: "${question}"

Hãy phân tích:
1. Câu hỏi này có chứa tham chiếu ngầm hoặc rõ ràng đến tài liệu đã đề cập trước đó không?
2. Nếu có, tham chiếu đó là gì và liên quan đến tài liệu nào?
3. Nếu có thể, hãy cung cấp câu hỏi đã giải quyết tham chiếu (thay thế từ "này", "đó", "tài liệu đó" bằng tên tài liệu cụ thể)

QUAN TRỌNG:
- Tham chiếu có thể là từ như "tài liệu đó", "file này", "quy định đó", "sơ đồ này", hoặc chỉ đơn giản là "nó"
- Nếu câu hỏi đề cập đến phòng ban hoặc công ty (VD: "Ban công nghệ thông tin có mấy người"), đây KHÔNG phải là tham chiếu
- Nếu câu hỏi có từ như "tài liệu số 1", "file thứ hai", đó LÀ tham chiếu đến thứ tự tài liệu trong câu trả lời trước
- Câu hỏi ngắn như "chi tiết hơn" hoặc "nói thêm" thường là tham chiếu ngầm đến chủ đề trước đó

Trả về kết quả dạng JSON với cấu trúc:
{
  "hasReference": boolean,
  "referenceType": "direct" | "indirect" | "none",
  "referencedDocument": "tên tài liệu hoặc null",
  "resolvedQuestion": "câu hỏi đã giải quyết tham chiếu hoặc câu hỏi gốc",
  "confidence": 0-100,
  "explanation": "giải thích ngắn gọn về phân tích"
}

LƯU Ý: Chỉ trả về JSON, không có nội dung khác.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let analysisText = response.text();
      
      // Đảm bảo kết quả là JSON
      try {
        // Loại bỏ các ký tự không phải JSON nếu có
        if (analysisText.includes('```json')) {
          analysisText = analysisText.split('```json')[1].split('```')[0].trim();
        }
        const analysis = JSON.parse(analysisText);
        
        console.log(`✅ Phân tích tham chiếu hoàn thành: ${analysis.hasReference ? 'Có tham chiếu' : 'Không có tham chiếu'}`);
        console.log(`   - Loại tham chiếu: ${analysis.referenceType}`);
        console.log(`   - Độ tin cậy: ${analysis.confidence}%`);
        console.log(`   - Giải thích: ${analysis.explanation}`);
        
        return {
          hasReference: analysis.hasReference,
          referenceType: analysis.referenceType,
          referencedDocument: analysis.referencedDocument,
          resolvedQuestion: analysis.resolvedQuestion || question,
          confidence: analysis.confidence,
          explanation: analysis.explanation
        };
      } catch (parseError) {
        console.error('Lỗi phân tích kết quả JSON:', parseError);
        console.log('Phản hồi gốc:', analysisText);
        
        // Trả về kết quả mặc định nếu không thể phân tích JSON
        return {
          hasReference: false,
          resolvedQuestion: question,
          confidence: 50,
          explanation: "Không thể phân tích kết quả AI"
        };
      }
    } catch (error) {
      console.error('Error in detectReferences:', error);
      // Trả về an toàn nếu có lỗi
      return { 
        hasReference: false, 
        resolvedQuestion: question,
        confidence: 50,
        explanation: "Lỗi khi phân tích tham chiếu"
      };
    }
  }

  // Handle general chatbot questions without documents
  async handleGeneralChatbotQuestion(question) {
    try {
      console.log(`🤖 Calling Gemini API for general question...`);
      
      const prompt = `Bạn là một trợ lý AI thân thiện và hữu ích. Hãy trả lời câu hỏi sau một cách tự nhiên và hữu ích:

NGUYÊN TẮC:
1. Trả lời bằng tiếng Việt một cách tự nhiên và thân thiện
2. Nếu câu hỏi về kiến thức chung, hãy trả lời với thông tin chính xác
3. Nếu không biết, hãy thẳng thắn nói "Tôi không biết"
4. Luôn tích cực và hữu ích
5. Không trả lời về nội dung nhạy cảm

CÂUHỎI: ${question}

TRÁLỜI:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const answer = response.text();
      console.log(`✅ Gemini API response received`);
      return answer;
    } catch (error) {
      console.error('Error in handleGeneralChatbotQuestion:', error);
      console.error('Error details:', error.message);
      
      // Fallback response for common questions
      if (question.toLowerCase().includes('việt nam') && question.toLowerCase().includes('tỉnh')) {
        return 'Việt Nam có 63 tỉnh thành phố, bao gồm 58 tỉnh và 5 thành phố trực thuộc trung ương (Hà Nội, TP.HCM, Đà Nẵng, Hải Phòng, Cần Thơ).';
      }
      
      return 'Xin lỗi, tôi đang gặp vấn đề kỹ thuật với API. Vui lòng thử lại sau hoặc đặt câu hỏi khác.';
    }
  }

  // Process questions with knowledge base entries (priority for policies)
  async processWithKnowledge(question, knowledgeEntries, startTime) {
    try {
      console.log(`📚 Processing with ${knowledgeEntries.length} knowledge entries`);
      
      // Generate context from knowledge entries
      const context = this.generateKnowledgeContext(knowledgeEntries);
      
      const prompt = `Bạn là trợ lý AI của hệ thống quản lý kiến thức doanh nghiệp. Hãy trả lời câu hỏi dựa trên thông tin đã học được:

KIẾN THỨC ĐÃ HỌC:
${context}

NGUYÊN TẮC:
1. Ưu tiên sử dụng thông tin từ kiến thức đã học
2. Trả lời chính xác và chi tiết
3. Trả lời bằng tiếng Việt tự nhiên
4. Nếu không tìm thấy thông tin chính xác, hãy nói rõ
5. Đưa ra câu trả lời có cấu trúc và dễ hiểu

CÂUHỎI: ${question}

TRÁLỜI:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const answer = response.text();
      const responseTime = Date.now() - startTime;
      
      console.log(`✅ Knowledge-based answer generated: ${answer.substring(0, 100)}...`);
      
      // Save to database
      await db.createQuestion({
        question,
        answer,
        documentIds: [], // Knowledge entries don't have document IDs
        responseTime
      });
      
      return {
        answer,
        documentIds: [],
        relevantDocuments: knowledgeEntries.map(entry => ({
          id: entry.id,
          name: entry.question,
          type: 'knowledge',
          relevanceScore: entry.relevanceScore || 0
        })),
        responseTime
      };
    } catch (error) {
      console.error('Error processing with knowledge:', error);
      throw error;
    }
  }

  // Process questions with documents
  async processWithDocuments(question, relevantDocs, startTime) {
    try {
      // Ưu tiên mapping structured metadata
      let context = '';
      relevantDocs.forEach((doc, index) => {
        context += `\n[Tài liệu ${index + 1}: ${doc.dc_title || doc.original_name || "Không có tên"}]\n`;
        
        // Thêm thông tin từ document_metadata
        if (doc.dc_description) {
          context += `Mô tả: ${doc.dc_description}\n`;
        }
        
        if (doc.dc_subject && doc.dc_subject.length > 0) {
          context += `Chủ đề: ${Array.isArray(doc.dc_subject) ? doc.dc_subject.join(', ') : doc.dc_subject}\n`;
        }
        
        if (doc.dc_type) {
          context += `Loại tài liệu: ${doc.dc_type}\n`;
        }
        
        if (doc.document_summary) {
          context += `Tóm tắt: ${doc.document_summary}\n`;
        }
        
        if (doc.keywords && doc.keywords.length > 0) {
          context += `Từ khóa: ${Array.isArray(doc.keywords) ? doc.keywords.join(', ') : doc.keywords}\n`;
        }
        
        if (doc.categories && doc.categories.length > 0) {
          context += `Danh mục: ${Array.isArray(doc.categories) ? doc.categories.join(', ') : doc.categories}\n`;
        }
        
        if (doc.tags && doc.tags.length > 0) {
          context += `Tags: ${Array.isArray(doc.tags) ? doc.tags.join(', ') : doc.tags}\n`;
        }
        
        if (doc.entities) {
          context += `Entities: ${JSON.stringify(doc.entities)}\n`;
        }
        
        if (doc.key_values) {
          context += `Key-Value: ${JSON.stringify(doc.key_values)}\n`;
        }
        
        if (doc.document_sections) {
            context += `Sections:\n`;
          if (Array.isArray(doc.document_sections)) {
            doc.document_sections.forEach((section, i) => {
              context += `- ${section.title ? section.title + ': ' : ''}${section.content || ''}\n`;
            });
          } else {
            context += JSON.stringify(doc.document_sections) + '\n';
          }
        }
        
        if (doc.common_questions) {
          context += `Câu hỏi thường gặp:\n`;
          if (Array.isArray(doc.common_questions)) {
            doc.common_questions.forEach((qa, i) => {
              context += `- Q: ${qa.question}\n  A: ${qa.answer}\n`;
            });
          } else {
            context += JSON.stringify(doc.common_questions) + '\n';
          }
        }
        
        // Thêm nội dung trích xuất
        if (doc.extracted_text) {
          context += `Nội dung:\n${doc.extracted_text.substring(0, 2000)}\n`;
        } else if (doc.content_text) {
          context += `Nội dung:\n${doc.content_text.substring(0, 2000)}\n`;
        }
        
        // Thêm key_information nếu có
        if (doc.key_information) {
          context += `Thông tin chính: ${JSON.stringify(doc.key_information)}\n`;
        }
      });
      
      // Create enhanced prompt for process-oriented answers
      const prompt = `
Bạn là một trợ lý AI chuyên nghiệp về quy trình và quản lý doanh nghiệp, nhiệm vụ của bạn là trả lời câu hỏi dựa trên các tài liệu công ty được cung cấp.

NGUYÊN TẮC QUAN TRỌNG:
1. CHỈ trả lời dựa trên thông tin có trong tài liệu được cung cấp
2. Nếu không có thông tin, hãy nói "Thông tin này không có trong tài liệu hiện tại"
3. Trả lời bằng tiếng Việt, rõ ràng và chuyên nghiệp
4. Trích dẫn tên tài liệu khi có thể
5. Nếu có nhiều thông tin liên quan, hãy tổng hợp một cách logic

ĐẶC BIỆT QUAN TRỌNG - KHI TRẢ LỜI VỀ QUY TRÌNH:
• Liệt kê từng BƯỚC một cách rõ ràng và có thứ tự
• Chỉ rõ AI DUYỆT mỗi bước (nếu có trong tài liệu)
• Chỉ rõ THỜI GIAN xử lý mỗi bước (nếu có)
• Chỉ rõ TÀI LIỆU cần thiết cho mỗi bước
• Sử dụng format:
  **Bước 1:** [Mô tả bước]
  - Người duyệt: [Tên/chức vụ]
  - Thời gian: [Thời gian xử lý]
  - Tài liệu: [Các giấy tờ cần thiết]

KHI TRẢ LỜI VỀ DANH SÁCH CÔNG TY/QUY ĐỊNH:
• Phân loại theo HẠNG MỤC rõ ràng
• Sử dụng bullet points hoặc numbered list
• Nhóm theo chủ đề (VD: Tài chính, Nhân sự, Quản lý...)

NGỮ CẢNH TÀI LIỆU:
${context}

CÂUHỎI: ${question}

TRÁLỜI:`;

      // Generate response using Gemini
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const answer = response.text();

      const responseTime = Date.now() - startTime;
      const documentIds = relevantDocs.map(doc => doc.id);

      // Save question and answer to database
      await db.createQuestion({
        question,
        answer,
        documentIds,
        responseTime
      });

      return {
        answer,
        documentIds,
        relevantDocuments: relevantDocs.map(doc => ({
          id: doc.id,
          name: doc.dc_title || doc.original_name || doc.name || "Không có tên",
          relevanceScore: doc.relevanceScore
        })),
        responseTime
      };

    } catch (error) {
      console.error('Error in processWithDocuments:', error);
      throw new Error('Có lỗi xảy ra khi xử lý câu hỏi. Vui lòng thử lại.');
    }
  }

  // Generate context from relevant documents
  generateContext(documents) {
    let context = '';
    
    documents.forEach((doc, index) => {
      context += `\n[Tài liệu ${index + 1}: ${doc.original_name}]\n`;
      // Limit context length to avoid token limits
      const content = (doc.content_text || '').substring(0, 2000);
      context += content + '\n';
    });
    
    return context;
  }

  // Generate context from knowledge entries
  generateKnowledgeContext(knowledgeEntries) {
    let context = '';
    knowledgeEntries.forEach((entry, index) => {
      context += `\n[Kiến thức ${index + 1}: ${entry.question}]\n`;
      context += entry.answer + '\n';
    });
    return context;
  }

  // Summarize document content
  async summarizeDocument(documentId) {
    try {
      const document = await db.getDocumentById(documentId);
      
      if (!document || !document.content_text) {
        throw new Error('Không tìm thấy tài liệu hoặc tài liệu chưa được xử lý');
      }

      const prompt = `
Hãy tóm tắt nội dung của tài liệu sau một cách ngắn gọn và súc tích:

TÊN TÀI LIỆU: ${document.original_name}

NỘI DUNG:
${document.content_text.substring(0, 4000)}

Yêu cầu:
- Tóm tắt bằng tiếng Việt
- Nêu rõ các điểm chính
- Độ dài khoảng 200-300 từ
- Sử dụng bullet points nếu cần

TÓM TẮT:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return {
        summary: response.text(),
        documentName: document.original_name,
        documentId: document.id
      };

    } catch (error) {
      console.error('Error in summarizeDocument:', error);
      throw error;
    }
  }

  // Extract key information from documents
  async extractKeyInfo(searchTerm) {
    try {
      const documents = await db.searchDocuments(searchTerm);
      
      if (documents.length === 0) {
        return {
          info: 'Không tìm thấy thông tin nào liên quan.',
          documents: []
        };
      }

      const context = this.generateContext(documents.slice(0, 3));
      
      const prompt = `
Từ các tài liệu sau, hãy trích xuất thông tin quan trọng liên quan đến "${searchTerm}":

${context}

Yêu cầu:
- Trích xuất thông tin chính xác từ tài liệu
- Sắp xếp theo mức độ quan trọng
- Ghi rõ nguồn tài liệu
- Trả lời bằng tiếng Việt

THÔNG TIN TRÍCH XUẤT:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      return {
        info: response.text(),
        documents: documents.map(doc => ({
          id: doc.id,
          name: doc.original_name,
          uploadDate: doc.upload_date
        }))
      };

    } catch (error) {
      console.error('Error in extractKeyInfo:', error);
      throw error;
    }
  }

  // Main method to ask questions
  async askQuestion(question, options = {}) {
    const startTime = Date.now();
    try {
      console.log(`🔍 Processing question: "${question}"`);
      
      // Extract options
      const { 
        documents = [], 
        knowledgeEntries = [],
        companyInfo = null,
        departmentInfo = null,
        analysisResult = {}
      } = options;

      // Log data sources
      console.log(`📊 Data sources: ${documents.length} documents, ${knowledgeEntries.length} knowledge entries`);
      if (companyInfo) console.log(`🏢 Company info: ${companyInfo.company_name || companyInfo.name}`);
      if (departmentInfo) console.log(`🏢 Department info: ${departmentInfo.name}`);
      
      // Debug log documents
      if (documents.length > 0) {
        console.log(`🔍 Document IDs: ${documents.map(doc => doc.id).join(', ')}`);
        console.log(`🔍 Document titles: ${documents.map(doc => doc.dc_title || doc.original_name || "Không có tên").join(', ')}`);
      }
      
      // Check for document summarization request
      const isSummarizeRequest = question.toLowerCase().includes('tóm tắt') && 
                               (question.toLowerCase().includes('tài liệu') || 
                                question.toLowerCase().includes('document'));
      
      if (isSummarizeRequest && documents.length > 0) {
        console.log(`📑 Handling document summarization request`);
        const doc = documents[0]; // Use the first document
        
        // Tạo tóm tắt từ metadata của document
        let summary = `Tóm tắt tài liệu "${doc.dc_title || doc.original_name || "Không có tên"}":\n\n`;
        
        // Thêm thông tin cơ bản
        summary += `- Loại tài liệu: ${doc.dc_type || "Không xác định"}\n`;
        if (doc.dc_date) summary += `- Ngày tạo: ${new Date(doc.dc_date).toLocaleDateString('vi-VN')}\n`;
        if (doc.dc_creator && doc.dc_creator.length) summary += `- Tác giả: ${Array.isArray(doc.dc_creator) ? doc.dc_creator.join(', ') : doc.dc_creator}\n`;
        if (doc.dc_publisher) summary += `- Nhà xuất bản: ${doc.dc_publisher}\n`;
        if (doc.dc_description) summary += `- Mô tả: ${doc.dc_description}\n`;
        if (doc.file_size) summary += `- Kích thước: ${doc.file_size} bytes\n`;
        
        // Thêm từ khóa và chủ đề
        if (doc.keywords && doc.keywords.length) {
          summary += `- Từ khóa: ${Array.isArray(doc.keywords) ? doc.keywords.join(', ') : doc.keywords}\n`;
        }
        if (doc.dc_subject && doc.dc_subject.length) {
          summary += `- Chủ đề: ${Array.isArray(doc.dc_subject) ? doc.dc_subject.join(', ') : doc.dc_subject}\n`;
        }
        
        // Thêm tóm tắt nội dung nếu có
        if (doc.document_summary) {
          summary += `\nTóm tắt nội dung:\n${doc.document_summary}\n`;
        }
        
        // Nếu không có tóm tắt sẵn, tạo tóm tắt từ nội dung
        if (!doc.document_summary && (doc.extracted_text || doc.content_text)) {
          const content = doc.extracted_text || doc.content_text;
          const prompt = `
Hãy tóm tắt nội dung của tài liệu sau một cách ngắn gọn và súc tích:

TÊN TÀI LIỆU: ${doc.dc_title || doc.original_name || "Không có tên"}

NỘI DUNG:
${content.substring(0, 4000)}

Yêu cầu:
- Tóm tắt bằng tiếng Việt
- Nêu rõ các điểm chính
- Độ dài khoảng 200-300 từ
- Sử dụng bullet points nếu cần

TÓM TẮT:`;

          try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            summary += `\nTóm tắt nội dung:\n${response.text()}\n`;
          } catch (error) {
            console.error('Error generating summary:', error);
            summary += `\nKhông thể tạo tóm tắt tự động.\n`;
          }
        }
        
        // Thêm thông tin bổ sung nếu có
        if (doc.key_information) {
          summary += `\nThông tin chính:\n`;
          try {
            const keyInfo = typeof doc.key_information === 'string' ? 
                          JSON.parse(doc.key_information) : doc.key_information;
            
            Object.entries(keyInfo).forEach(([key, value]) => {
              if (typeof value !== 'object') {
                summary += `- ${key}: ${value}\n`;
              } else if (value !== null) {
                summary += `- ${key}: ${JSON.stringify(value)}\n`;
              }
            });
          } catch (error) {
            console.error('Error processing key_information:', error);
            summary += `- ${doc.key_information}\n`;
          }
        }
        
        console.log(`✅ Generated summary for document: ${doc.id}`);
        
        return {
          answer: summary,
          documentIds: [doc.id],
          relevantDocuments: [doc],
          responseTime: Date.now() - startTime
        };
      }
      
      // Process with documents if available (priority)
      if (documents.length > 0) {
        console.log(`📄 Processing with ${documents.length} documents`);
        return await this.processWithDocuments(question, documents, startTime);
      }
      
      // Process with knowledge base entries if available
      if (knowledgeEntries.length > 0) {
        console.log(`📚 Processing with ${knowledgeEntries.length} knowledge entries`);
        return await this.processWithKnowledge(question, knowledgeEntries, startTime);
      }
      
      // Fallback to general chatbot
      console.log(`💬 No specific data sources, using general chatbot`);
      const answer = await this.handleGeneralChatbotQuestion(question);
      
      return {
        answer,
        documentIds: [],
        relevantDocuments: [],
        responseTime: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('Error in askQuestion:', error);
      return {
        answer: 'Xin lỗi, tôi không thể trả lời câu hỏi này do lỗi kỹ thuật. Vui lòng thử lại sau.',
        documentIds: [],
        relevantDocuments: [],
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }
}

module.exports = GeminiAiService; 