const { GoogleGenerativeAI } = require('@google/generative-ai');
const { db } = require('./database');
require('dotenv').config();

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  // Split text into chunks for better processing
  chunkText(text, maxLength = 3000) {
    const chunks = [];
    let currentChunk = '';
    
    const sentences = text.split(/[.!?]+/);
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      } else {
        currentChunk += sentence + '. ';
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // Find relevant documents based on question
  async findRelevantDocuments(question, limit = 5) {
    try {
      // Simple keyword search - can be improved with vector search
      const keywords = question.toLowerCase().split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 5);
      
      const documents = await db.getDocuments();
      const relevantDocs = [];
      
      for (const doc of documents) {
        if (!doc.content_text) continue;
        
        const content = doc.content_text.toLowerCase();
        let relevanceScore = 0;
        
        for (const keyword of keywords) {
          const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
          relevanceScore += matches;
        }
        
        if (relevanceScore > 0) {
          relevantDocs.push({ ...doc, relevanceScore });
        }
      }
      
      return relevantDocs
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
    } catch (error) {
      console.error('Error finding relevant documents:', error);
      throw error;
    }
  }

  // Generate context from relevant documents
  generateContext(documents) {
    let context = '';
    
    documents.forEach((doc, index) => {
      context += `\n[Tài liệu ${index + 1}: ${doc.original_name}]\n`;
      // Limit context length to avoid token limits
      const content = doc.content_text.substring(0, 2000);
      context += content + '\n';
    });
    
    return context;
  }

  // Content policy - check for inappropriate content
  isSensitiveContent(question) {
    const sensitivePatterns = [
      // Sexual content
      /sex|tình dục|làm tình|quan hệ|khiêu dâm|porn|xxx|nude|nóng bỏng|gợi cảm/i,
      // Violence/weapons
      /súng|đạn|vũ khí|giết|chết|bạo lực|đánh nhau|weapon|gun|kill|violence|bomb|nổ|ma túy|drug/i,
      // Hate speech
      /chửi|mắng|ghét|khinh|phân biệt|racist|hate/i,
      // Illegal activities
      /hack|lừa đảo|scam|cheat|gian lận|bất hợp pháp|illegal/i,
      // Gambling
      /cờ bạc|gambling|bet|cược|casino/i
    ];
    
    return sensitivePatterns.some(pattern => pattern.test(question.trim()));
  }

  // Check if question is asking for specific document information
  isDocumentSpecificQuestion(question) {
    const documentKeywords = [
      'quy định', 'chính sách', 'policy', 'tài liệu', 'văn bản', 'hướng dẫn',
      'quy trình', 'process', 'procedure', 'công ty', 'company', 'phòng ban',
      'nghỉ phép', 'leave', 'vacation', 'lương', 'salary', 'thưởng', 'bonus',
      'kỷ luật', 'discipline', 'vi phạm', 'violation', 'đánh giá', 'evaluation',
      'tuyển dụng', 'recruitment', 'training', 'đào tạo', 'bảo hiểm', 'insurance',
      'hợp đồng', 'contract', 'thỏa thuận', 'agreement', 'báo cáo', 'report'
    ];
    
    return documentKeywords.some(keyword => 
      question.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // Check if question is a general greeting or system question
  isGeneralQuestion(question) {
    const greetingPatterns = [
      /^(xin chào|hello|hi|chào|hey)/i,
      /^(cảm ơn|thank you|thanks)/i,
      /^(bạn là ai|what are you|who are you)/i,
      /^(bạn có thể làm gì|what can you do)/i,
      /^(hướng dẫn|help|giúp đỡ)$/i,
      /^(hệ thống|system|hoạt động)/i,
      /^(test|testing|thử nghiệm)$/i
    ];
    
    return greetingPatterns.some(pattern => pattern.test(question.trim()));
  }

  // Handle general questions without document search
  async handleGeneralQuestion(question) {
    const lowerQuestion = question.toLowerCase().trim();
    
    if (lowerQuestion.includes('xin chào') || lowerQuestion.includes('chào') || lowerQuestion.includes('hello') || lowerQuestion.includes('hi')) {
      return 'Xin chào! Tôi là trợ lý AI của hệ thống quản lý kiến thức PDF. Tôi có thể giúp bạn:\n\n• Trả lời câu hỏi dựa trên tài liệu đã upload\n• Tìm kiếm thông tin trong tài liệu\n• Tóm tắt nội dung tài liệu\n• Trích xuất thông tin quan trọng\n\nHãy upload tài liệu PDF và đặt câu hỏi, tôi sẽ giúp bạn tìm câu trả lời!';
    }
    
    if (lowerQuestion.includes('cảm ơn') || lowerQuestion.includes('thank you') || lowerQuestion.includes('thanks')) {
      return 'Không có gì! Tôi luôn sẵn sàng giúp đỡ bạn với các câu hỏi về tài liệu. Hãy tiếp tục đặt câu hỏi nếu cần nhé!';
    }
    
    if (lowerQuestion.includes('bạn là ai') || lowerQuestion.includes('what are you') || lowerQuestion.includes('who are you')) {
      return 'Tôi là trợ lý AI được tích hợp với Gemini AI, chuyên trả lời câu hỏi dựa trên các tài liệu PDF trong hệ thống. Tôi có thể giúp bạn tìm kiếm thông tin, trả lời câu hỏi và tóm tắt nội dung từ các tài liệu đã được upload.';
    }
    
    if (lowerQuestion.includes('làm gì') || lowerQuestion.includes('what can you do') || lowerQuestion.includes('hướng dẫn') || lowerQuestion.includes('help')) {
      return 'Tôi có thể giúp bạn:\n\n📄 **Quản lý tài liệu**\n• Upload và xử lý file PDF\n• Tìm kiếm trong tài liệu\n• Tóm tắt nội dung\n\n💬 **Hỏi đáp thông minh**\n• Trả lời câu hỏi dựa trên tài liệu\n• Trích xuất thông tin quan trọng\n• Tìm kiếm semantic\n\n🔍 **Tìm kiếm**\n• Tìm theo từ khóa\n• Tìm theo chủ đề\n• Lọc theo tài liệu\n\nHãy upload tài liệu PDF và bắt đầu đặt câu hỏi!';
    }
    
    if (lowerQuestion.includes('hệ thống') || lowerQuestion.includes('system') || lowerQuestion.includes('hoạt động') || lowerQuestion.includes('test')) {
      return 'Hệ thống PDF Knowledge Management đang hoạt động bình thường! 🚀\n\n✅ Kết nối database: OK\n✅ Gemini AI: OK\n✅ Upload PDF: Sẵn sàng\n✅ Q&A: Sẵn sàng\n\nBạn có thể bắt đầu upload tài liệu PDF và đặt câu hỏi ngay bây giờ!';
    }
    
    return 'Xin chào! Tôi là trợ lý AI của hệ thống quản lý kiến thức PDF. Để tôi có thể trả lời câu hỏi một cách chính xác, vui lòng upload tài liệu PDF và đặt câu hỏi cụ thể về nội dung tài liệu.';
  }

  // Main Q&A function
  async askQuestion(question) {
    const startTime = Date.now();
    
    try {
      // Check for sensitive content first
      if (this.isSensitiveContent(question)) {
        const answer = 'Xin lỗi, tôi không thể trả lời câu hỏi này vì nó có thể chứa nội dung không phù hợp. Tôi chỉ có thể hỗ trợ với các câu hỏi tích cực và có tính xây dựng. Vui lòng đặt câu hỏi khác.';
        const responseTime = Date.now() - startTime;
        
        // Save to database for monitoring
        await db.createQuestion({
          question,
          answer,
          documentIds: [],
          responseTime
        });
        
        return {
          answer,
          documentIds: [],
          relevantDocuments: [],
          responseTime
        };
      }

      // Check if it's a general question first
      if (this.isGeneralQuestion(question)) {
        const answer = await this.handleGeneralQuestion(question);
        const responseTime = Date.now() - startTime;
        
        // Save to database
        await db.createQuestion({
          question,
          answer,
          documentIds: [],
          responseTime
        });
        
        return {
          answer,
          documentIds: [],
          relevantDocuments: [],
          responseTime
        };
      }
      
      // Check if it's a document-specific question
      if (this.isDocumentSpecificQuestion(question)) {
        // Find relevant documents for specific questions
        const relevantDocs = await this.findRelevantDocuments(question);
        
        if (relevantDocs.length === 0) {
          const answer = 'Xin lỗi, tôi không tìm thấy tài liệu nào liên quan đến câu hỏi của bạn. Vui lòng:\n\n• Kiểm tra lại từ khóa\n• Upload thêm tài liệu liên quan\n• Thử đặt câu hỏi khác\n\nBạn có thể sử dụng chức năng tìm kiếm để xem các tài liệu hiện có trong hệ thống.';
          const responseTime = Date.now() - startTime;
          
          // Save to database
          await db.createQuestion({
            question,
            answer,
            documentIds: [],
            responseTime
          });
          
          return {
            answer,
            documentIds: [],
            relevantDocuments: [],
            responseTime
          };
        }
        
        // Process with documents
        return await this.processWithDocuments(question, relevantDocs, startTime);
      }
      
      // For general questions, use Gemini without documents
      const answer = await this.handleGeneralChatbotQuestion(question);
      const responseTime = Date.now() - startTime;
      
      // Save to database
      await db.createQuestion({
        question,
        answer,
        documentIds: [],
        responseTime
      });
      
      return {
        answer,
        documentIds: [],
        relevantDocuments: [],
        responseTime
      };
      
    } catch (error) {
      console.error('Error in askQuestion:', error);
      throw new Error('Có lỗi xảy ra khi xử lý câu hỏi. Vui lòng thử lại.');
    }
  }

  // Handle general chatbot questions without documents
  async handleGeneralChatbotQuestion(question) {
    try {
      const prompt = `
Bạn là một trợ lý AI thân thiện và hữu ích. Hãy trả lời câu hỏi sau một cách tự nhiên và hữu ích:

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
      return response.text();
    } catch (error) {
      console.error('Error in handleGeneralChatbotQuestion:', error);
      return 'Xin lỗi, tôi đang gặp vấn đề kỹ thuật. Vui lòng thử lại sau.';
    }
  }

  // Process questions with documents
  async processWithDocuments(question, relevantDocs, startTime) {
    try {

      // Generate context from relevant documents
      const context = this.generateContext(relevantDocs);
      
      // Create prompt for Gemini
      const prompt = `
Bạn là một trợ lý AI chuyên nghiệp, nhiệm vụ của bạn là trả lời câu hỏi dựa trên các tài liệu công ty được cung cấp.

NGUYÊN TẮC QUAN TRỌNG:
1. CHỈ trả lời dựa trên thông tin có trong tài liệu được cung cấp
2. Nếu không có thông tin, hãy nói "Thông tin này không có trong tài liệu hiện tại"
3. Trả lời bằng tiếng Việt, rõ ràng và chuyên nghiệp
4. Trích dẫn tên tài liệu khi có thể
5. Nếu có nhiều thông tin liên quan, hãy tổng hợp một cách logic

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

module.exports = new GeminiService(); 