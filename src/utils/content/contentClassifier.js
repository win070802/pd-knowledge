const { db } = require('../../../database');

class ContentClassifier {

  // Content policy - check for inappropriate content using database rules
  async isSensitiveContent(question) {
    try {
      const rules = await db.getSensitiveRules(true); // Get only active rules
      
      for (const rule of rules) {
        try {
          const pattern = new RegExp(rule.pattern, 'i');
          if (pattern.test(question.trim())) {
            console.log(`🚫 Sensitive content detected by rule: ${rule.rule_name}`);
            return true;
          }
        } catch (error) {
          console.error(`Error in regex pattern for rule ${rule.rule_name}:`, error);
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking sensitive content:', error);
      // Fallback to basic patterns if database fails
      const basicPatterns = [
        /sex|tình dục|làm tình|quan hệ|khiêu dâm|porn|xxx|nude/i,
        /súng|đạn|vũ khí|giết|chết|bạo lực|weapon|gun|kill|violence|bomb/i,
        /hack|lừa đảo|scam|cheat|gian lận|illegal/i
      ];
      return basicPatterns.some(pattern => pattern.test(question.trim()));
    }
  }

  // Check if question is asking for specific document information
  isDocumentSpecificQuestion(question) {
    // Strong indicators of document-specific questions
    const strongDocumentKeywords = [
      'quy định', 'chính sách', 'policy', 'tài liệu', 'văn bản', 'hướng dẫn',
      'quy trình', 'process', 'procedure', 'phòng ban', 'department',
      'nghỉ phép', 'leave', 'vacation', 'lương', 'salary', 'thưởng', 'bonus',
      'kỷ luật', 'discipline', 'vi phạm', 'violation', 'đánh giá', 'evaluation',
      'tuyển dụng', 'recruitment', 'training', 'đào tạo', 'bảo hiểm', 'insurance',
      'hợp đồng', 'contract', 'thỏa thuận', 'agreement', 'báo cáo', 'report',
      'sơ đồ', 'chức năng', 'tổ chức', 'cơ cấu', 'cấu trúc', 'ban', 'phòng',
      'bộ phận', 'đơn vị', 'trưởng phòng', 'giám đốc', 'chủ tịch', 'ceo',
      'organizational chart', 'organization', 'structure', 'hierarchy'
    ];
    
    // Company-related phrases that indicate document queries vs general questions
    const companyDocumentPhrases = [
      'quy định của công ty', 'chính sách công ty', 'công ty quy định',
      'trong công ty', 'ở công ty', 'tại công ty', 'công ty có'
    ];
    
    const questionLower = question.toLowerCase();
    
    // Check for strong document keywords
    const hasStrongKeyword = strongDocumentKeywords.some(keyword => 
      questionLower.includes(keyword.toLowerCase())
    );
    
    // Check for company document phrases
    const hasCompanyDocumentPhrase = companyDocumentPhrases.some(phrase =>
      questionLower.includes(phrase.toLowerCase())
    );
    
    // Don't treat general "What is X company?" questions as document-specific
    const isGeneralCompanyQuestion = questionLower.match(/^.*(là công ty nào|là công ty gì|what.*company)/);
    
    return (hasStrongKeyword || hasCompanyDocumentPhrase) && !isGeneralCompanyQuestion;
  }

  // Check if question is a general greeting or system question
  isGeneralQuestion(question) {
    const questionLower = question.toLowerCase().trim();
    
    // Danh sách các mẫu câu hỏi chung
    const generalPatterns = [
      // Lời chào và câu hỏi về hệ thống
      /^(xin chào|hello|hi|chào|hey)/i,
      /^(cảm ơn|thank you|thanks)/i,
      /^(bạn là ai|what are you|who are you)/i,
      /^(bạn có thể làm gì|what can you do)/i,
      /^(hướng dẫn|help|giúp đỡ)$/i,
      /^(hệ thống|system|hoạt động)/i,
      /^(test|testing|thử nghiệm)$/i,
    ];
    
    // Các từ khóa chỉ ra câu hỏi liên quan đến kiến thức chung ngoài phạm vi công ty
    const generalKeywords = [
      'việt nam', 'thế giới', 'quốc gia', 'châu lục', 'châu á', 'châu âu', 'châu mỹ',
      'dân số', 'diện tích', 'thủ đô', 'tổng thống', 'thủ tướng', 'chủ tịch',
      'lịch sử', 'địa lý', 'kinh tế', 'chính trị', 'xã hội', 'văn hóa',
      'định nghĩa', 'khái niệm', 'là gì', 'ý nghĩa', 'giải thích',
      'tại sao', 'vì sao', 'lý do', 'nguyên nhân', 'mục đích'
    ];
    
    // Các từ khóa liên quan đến công ty hoặc tài liệu
    const documentKeywords = [
      'tài liệu', 'document', 'file', 'pdf', 'quy định', 'quy trình',
      'chính sách', 'hướng dẫn', 'sơ đồ', 'công ty', 'phòng ban',
      'nhân sự', 'tài chính', 'pháp chế', 'it', 'marketing',
      'pdh', 'pdi', 'pde', 'pdhos', 'rhs', 'phát đạt'
    ];
    
    // Kiểm tra nếu câu hỏi khớp với các mẫu câu hỏi chung
    const isGeneralPattern = generalPatterns.some(pattern => pattern.test(questionLower));
    
    // Kiểm tra nếu câu hỏi chứa từ khóa kiến thức chung
    const hasGeneralKeyword = generalKeywords.some(keyword => 
      questionLower.includes(keyword.toLowerCase())
    );
    
    // Kiểm tra nếu câu hỏi KHÔNG chứa từ khóa liên quan đến tài liệu hoặc công ty
    const hasNoDocumentKeyword = !documentKeywords.some(keyword => 
      questionLower.includes(keyword.toLowerCase())
    );
    
    // Câu hỏi được coi là câu hỏi chung nếu:
    // 1. Khớp với mẫu câu hỏi chung, HOẶC
    // 2. Chứa từ khóa kiến thức chung VÀ không chứa từ khóa tài liệu/công ty
    return isGeneralPattern || (hasGeneralKeyword && hasNoDocumentKeyword);
  }

  // Handle general questions without document search
  async handleGeneralQuestion(question) {
    const lowerQuestion = question.toLowerCase().trim();
    
    // Xử lý câu chào và giới thiệu
    if (lowerQuestion.includes('xin chào') || lowerQuestion.includes('chào') || lowerQuestion.includes('hello') || lowerQuestion.includes('hi')) {
      return 'Xin chào! Tôi là trợ lý AI của hệ thống quản lý kiến thức PDF. Tôi có thể giúp bạn tìm kiếm thông tin trong tài liệu của công ty, trả lời câu hỏi về quy định, quy trình và tìm kiếm tài liệu theo công ty.';
    }
    
    if (lowerQuestion.includes('cảm ơn') || lowerQuestion.includes('thank you') || lowerQuestion.includes('thanks')) {
      return 'Không có gì! Tôi luôn sẵn sàng giúp đỡ bạn với các câu hỏi về tài liệu của công ty. Hãy tiếp tục đặt câu hỏi nếu cần nhé!';
    }
    
    if (lowerQuestion.includes('bạn là ai') || lowerQuestion.includes('what are you') || lowerQuestion.includes('who are you')) {
      return 'Tôi là trợ lý AI được tích hợp với Gemini AI, chuyên trả lời câu hỏi dựa trên các tài liệu PDF trong hệ thống. Tôi được đào tạo để giúp bạn tìm kiếm thông tin, trả lời câu hỏi và tóm tắt nội dung từ các tài liệu của công ty đã được upload.';
    }
    
    if (lowerQuestion.includes('làm gì') || lowerQuestion.includes('what can you do') || lowerQuestion.includes('hướng dẫn') || lowerQuestion.includes('help')) {
      return 'Tôi có thể giúp bạn:\n\n📄 **Quản lý tài liệu**\n• Tìm kiếm tài liệu theo công ty (PDH, PDI, PDE, PDHOS, RHS)\n• Tìm kiếm thông tin trong tài liệu\n• Tóm tắt nội dung tài liệu\n\n💬 **Hỏi đáp thông minh**\n• Trả lời câu hỏi dựa trên tài liệu công ty\n• Trích xuất thông tin quan trọng\n• Tìm kiếm semantic\n\n🔍 **Ví dụ câu hỏi**\n• "Danh sách tài liệu thuộc PDI"\n• "Quy trình tuyển dụng của công ty"\n• "Chính sách nghỉ phép của PDH"';
    }
    
    if (lowerQuestion.includes('hệ thống') || lowerQuestion.includes('system') || lowerQuestion.includes('hoạt động') || lowerQuestion.includes('test')) {
      return 'Hệ thống PDF Knowledge Management đang hoạt động bình thường! 🚀\n\n✅ Kết nối database: OK\n✅ Gemini AI: OK\n✅ Upload PDF: Sẵn sàng\n✅ Q&A: Sẵn sàng\n\nBạn có thể bắt đầu đặt câu hỏi về tài liệu công ty ngay bây giờ!';
    }
    
    // Thông báo cho câu hỏi kiến thức chung không liên quan đến tài liệu
    if (this.isGeneralQuestion(question) && !lowerQuestion.includes('công ty') && !lowerQuestion.includes('tài liệu')) {
      return 'Tôi là trợ lý AI chuyên về tài liệu của công ty. Câu hỏi của bạn có vẻ là câu hỏi kiến thức chung nằm ngoài phạm vi dữ liệu của tôi. Tôi được thiết kế để trả lời các câu hỏi về tài liệu, quy định, quy trình của công ty. Vui lòng đặt câu hỏi liên quan đến tài liệu hoặc thông tin công ty để tôi có thể hỗ trợ tốt hơn. Ví dụ: "Danh sách tài liệu thuộc PDI" hoặc "Quy trình tuyển dụng của công ty".';
    }
    
    return 'Xin chào! Tôi là trợ lý AI của hệ thống quản lý kiến thức PDF. Tôi chỉ có thể trả lời các câu hỏi liên quan đến tài liệu và thông tin của công ty. Vui lòng đặt câu hỏi cụ thể về nội dung tài liệu hoặc yêu cầu danh sách tài liệu theo công ty (PDH, PDI, PDE, PDHOS, RHS).';
  }
}

module.exports = ContentClassifier; 