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
}

module.exports = ContentClassifier; 