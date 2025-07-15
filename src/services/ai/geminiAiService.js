const { GoogleGenerativeAI } = require('@google/generative-ai');
const { db } = require('../../../database');

class GeminiAiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
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
      // Generate context from relevant documents
      const context = this.generateContext(relevantDocs);
      
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
          name: doc.original_name,
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
}

module.exports = GeminiAiService; 