const { pool } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

class ConversationService {
  constructor() {
    this.sessionTimeout = 60 * 60 * 1000; // 60 minutes (increased from 30)
  }

  // Create or get existing conversation session
  async getOrCreateSession(sessionId = null, userId = null) {
    try {
      if (!sessionId) {
        sessionId = uuidv4();
      }

      // Check if session exists and is active
      const existingSession = await pool.query(
        'SELECT * FROM conversations WHERE session_id = $1 AND is_active = true',
        [sessionId]
      );

      if (existingSession.rows.length > 0) {
        const session = existingSession.rows[0];
        
        // Get current time from database to ensure UTC consistency
        const timeQuery = await pool.query('SELECT EXTRACT(EPOCH FROM NOW()) * 1000 as current_time_ms');
        const nowUTC = parseInt(timeQuery.rows[0].current_time_ms);
        
        // Get last activity time in milliseconds
        const lastActivity = new Date(session.last_activity);
        const lastActivityUTC = lastActivity.getTime();
        const timeDiff = nowUTC - lastActivityUTC;
        
        console.log(`⏰ Session ${sessionId}:`);
        console.log(`   Last activity: ${lastActivity.toISOString()} (${lastActivityUTC})`);
        console.log(`   Current time (DB): ${new Date(nowUTC).toISOString()} (${nowUTC})`);
        console.log(`   Time diff: ${timeDiff}ms (timeout: ${this.sessionTimeout}ms)`);
        
        if (timeDiff > this.sessionTimeout) {
          console.log(`⏰ Session expired, creating new one`);
          // Expire old session and create new one
          await this.expireSession(sessionId);
          return await this.createNewSession(sessionId, userId);
        }

        // Update last activity using database NOW() function  
        await pool.query(
          'UPDATE conversations SET last_activity = NOW() WHERE session_id = $1',
          [sessionId]
        );
        
        // Re-fetch updated session
        const updatedSession = await pool.query(
          'SELECT * FROM conversations WHERE session_id = $1 AND is_active = true',
          [sessionId]
        );
        
        console.log(`🔄 Updated session activity: ${sessionId}`);
        return updatedSession.rows[0];
      }

      return await this.createNewSession(sessionId, userId);
    } catch (error) {
      console.error('Error getting/creating session:', error);
      throw error;
    }
  }

  // Create new conversation session
  async createNewSession(sessionId, userId = null, retryCount = 0) {
    try {
      // If sessionId conflicts, generate a new one (max 3 retries)
      if (retryCount > 0 || !sessionId) {
        sessionId = uuidv4();
      }

      // Use current UTC timestamp
      const currentTimestamp = new Date();
      
      const result = await pool.query(
        `INSERT INTO conversations (session_id, user_id, context, started_at, last_activity) 
         VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *`,
        [sessionId, userId, JSON.stringify({})]
      );

              console.log(`✅ Created new conversation session: ${sessionId}`);
      return result.rows[0];
    } catch (error) {
      // Handle unique constraint violation by retrying with new UUID
      if (error.code === '23505' && retryCount < 3) {
        console.log(`🔄 Session ID conflict, retrying with new UUID (attempt ${retryCount + 1})`);
        return await this.createNewSession(null, userId, retryCount + 1);
      }
      
      console.error('Error creating new session:', error);
      throw error;
    }
  }

  // Save message to conversation
  async saveMessage(sessionId, messageType, content, relevantDocuments = [], metadata = {}) {
    try {
      // Get session without creating new one to avoid conflicts
      const sessionQuery = await pool.query(
        'SELECT * FROM conversations WHERE session_id = $1 AND is_active = true',
        [sessionId]
      );

      if (sessionQuery.rows.length === 0) {
        console.error(`❌ Session ${sessionId} not found for saving message`);
        return null;
      }

      const session = sessionQuery.rows[0];
      
      const result = await pool.query(
        `INSERT INTO conversation_messages 
         (conversation_id, message_type, content, relevant_documents, metadata)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          session.id,
          messageType,
          content,
          JSON.stringify(relevantDocuments),
          JSON.stringify(metadata)
        ]
      );

      // Update session context with latest relevant documents
      if (relevantDocuments.length > 0) {
        await pool.query(
          'UPDATE conversations SET context = $1, last_activity = NOW() WHERE session_id = $2',
          [JSON.stringify({ lastRelevantDocuments: relevantDocuments }), sessionId]
        );
      } else {
        // Update just the last_activity even if no documents
        await pool.query(
          'UPDATE conversations SET last_activity = NOW() WHERE session_id = $1',
          [sessionId]
        );
      }

      console.log(`💬 Saved ${messageType} to session ${sessionId}: ${result.rows[0].id}`);
      return result.rows[0];
    } catch (error) {
      console.error(`❌ Error saving ${messageType} to session ${sessionId}:`, error);
      return null; // Return null instead of throwing to prevent API failures
    }
  }

  // Get conversation history
  async getConversationHistory(sessionId, limit = 10) {
    try {
      const sessionQuery = await pool.query(
        'SELECT * FROM conversations WHERE session_id = $1 AND is_active = true',
        [sessionId]
      );

      if (sessionQuery.rows.length === 0) {
        console.log(`⚠️ Session ${sessionId} not found for history`);
        return [];
      }

      const session = sessionQuery.rows[0];
      
      const result = await pool.query(
        `SELECT * FROM conversation_messages 
         WHERE conversation_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [session.id, limit]
      );

      console.log(`📚 Retrieved ${result.rows.length} messages for session ${sessionId} (conversation_id: ${session.id})`);
      return result.rows.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  // Update session context
  async updateSessionContext(sessionId, newContext) {
    try {
      const session = await this.getOrCreateSession(sessionId);
      const currentContext = session.context || {};
      const updatedContext = { ...currentContext, ...newContext };

      await pool.query(
        'UPDATE conversations SET context = $1, last_activity = CURRENT_TIMESTAMP WHERE session_id = $2',
        [JSON.stringify(updatedContext), sessionId]
      );

      return updatedContext;
    } catch (error) {
      console.error('Error updating session context:', error);
      throw error;
    }
  }

  // Get session context
  async getSessionContext(sessionId) {
    try {
      const sessionQuery = await pool.query(
        'SELECT context FROM conversations WHERE session_id = $1 AND is_active = true',
        [sessionId]
      );
      
      return sessionQuery.rows.length > 0 ? sessionQuery.rows[0].context || {} : {};
    } catch (error) {
      console.error('Error getting session context:', error);
      return {};
    }
  }

  /**
   * Giải quyết các tham chiếu trong câu hỏi người dùng
   * 
   * Thuật toán xử lý:
   * 1. Tìm tài liệu từ ngữ cảnh (context) của phiên hội thoại hoặc lịch sử hội thoại
   * 2. Phân tích câu hỏi để tìm các tham chiếu trực tiếp ("tài liệu này", "sơ đồ đó"...)
   * 3. Phát hiện tham chiếu ngầm (câu ngắn, chi tiết về nội dung đã được đề cập)
   * 4. Phân tích từ khóa chủ đề để phát hiện người dùng đang nói về tài liệu cụ thể
   * 5. Chấm điểm mức độ phù hợp của từng tài liệu với câu hỏi
   * 6. Chọn tài liệu phù hợp nhất và thay thế các tham chiếu trong câu hỏi
   * 
   * @param {string} sessionId - ID phiên hội thoại
   * @param {string} question - Câu hỏi của người dùng
   * @returns {Object} Kết quả giải quyết tham chiếu
   */
  async resolveReferences(sessionId, question) {
    try {
      // Get session context directly without creating new session
      const sessionQuery = await pool.query(
        'SELECT context FROM conversations WHERE session_id = $1 AND is_active = true',
        [sessionId]
      );
      
      const context = sessionQuery.rows.length > 0 ? sessionQuery.rows[0].context : {};
      const history = await this.getConversationHistory(sessionId, 15); // Tăng số lượng tin nhắn lấy từ lịch sử

      // Kiểm tra nếu là câu hỏi đầu tiên trong phiên hội thoại, không xem là tham chiếu
      if (history.length <= 1) {
        console.log(`⚠️ Phiên hội thoại mới hoặc không có lịch sử, không coi là tham chiếu`);
        return { resolvedQuestion: question, hasReference: false };
      }

      // Mở rộng danh sách từ khóa tham chiếu
      const referenceKeywords = [
        'tài liệu đó', 'document đó', 'file đó', 'quy định đó',
        'tài liệu này', 'document này', 'file này', 'quy định này',
        'tài liệu trước', 'file trước', 'cái đó', 'cái này',
        'nó', 'đó', 'này', 'chi tiết', 'thông tin', 'nội dung'
      ];

      // Từ khóa dễ nhầm lẫn - cần xét trong ngữ cảnh cụ thể
      const contextualKeywords = [
        'sơ đồ', 'tài liệu', 'mô tả', 'phân tích', 'trên',
        'tóm tắt', 'hướng dẫn', 'quy trình', 'quy định'
      ];

      const questionLower = question.toLowerCase();
      
      // Kiểm tra các từ khóa chỉ ra rằng đây là truy vấn danh sách, không phải tham chiếu
      const listQueryKeywords = ['danh sách', 'liệt kê', 'có những', 'có mấy', 'có bao nhiêu'];
      const isListQuery = listQueryKeywords.some(keyword => questionLower.includes(keyword));
      
      // Kiểm tra nếu câu hỏi có chứa tên tài liệu cụ thể
      const hasSpecificDocumentName = questionLower.includes('.pdf') || questionLower.includes('.doc') || 
                                     questionLower.includes('.xlsx') || questionLower.includes('.ppt');
      
      // Lấy danh sách công ty từ database
      const companiesQuery = await pool.query('SELECT code, full_name FROM companies');
      const companies = companiesQuery.rows || [];
      
      // Tạo danh sách từ khóa công ty từ database
      const companyKeywords = [];
      companies.forEach(company => {
        if (company.code) companyKeywords.push(company.code.toLowerCase());
        if (company.full_name) {
          // Thêm cả tên đầy đủ và các phần của tên
          companyKeywords.push(company.full_name.toLowerCase());
          const nameParts = company.full_name.toLowerCase().split(' ');
          nameParts.forEach(part => {
            if (part.length > 2) companyKeywords.push(part);
          });
        }
      });
      
      // Thêm một số từ khóa mặc định cho các công ty phổ biến
      const defaultCompanyKeywords = ['phát đạt', 'phat dat', 'holding', 'invest'];
      defaultCompanyKeywords.forEach(keyword => {
        if (!companyKeywords.includes(keyword)) {
          companyKeywords.push(keyword);
        }
      });
      
      // Kiểm tra xem câu hỏi có chứa từ khóa công ty không
      const hasCompanyKeyword = companyKeywords.some(keyword => questionLower.includes(keyword));
      
      // Nếu là truy vấn danh sách kết hợp với tên công ty hoặc phòng ban, KHÔNG coi là tham chiếu
      if (isListQuery) {
        console.log(`⚠️ Câu hỏi là truy vấn danh sách, không coi là tham chiếu`);
        return { resolvedQuestion: question, hasReference: false };
      }
      
      // Nếu câu hỏi chứa tên tài liệu cụ thể, KHÔNG coi là tham chiếu
      if (hasSpecificDocumentName) {
        return { resolvedQuestion: question, hasReference: false };
      }
      
      // Kiểm tra câu hỏi về phòng ban
      const departmentKeywords = ['ban', 'phòng', 'bộ phận', 'team', 'nhóm', 'đội'];
      const isDepartmentQuestion = departmentKeywords.some(keyword => 
        questionLower.includes(keyword + ' ') || // Đảm bảo "ban" là từ riêng, không phải phần của từ khác
        questionLower.startsWith(keyword + ' ')
      );
      
      if (isDepartmentQuestion) {
        console.log(`⚠️ Câu hỏi về phòng ban, không coi là tham chiếu`);
        return { resolvedQuestion: question, hasReference: false };
      }
      
      // Kiểm tra nếu câu hỏi là câu hỏi chung không liên quan đến tài liệu
      const generalQuestionPatterns = [
        'việt nam', 'thế giới', 'là gì', 'định nghĩa', 'khái niệm',
        'bao nhiêu người', 'dân số', 'diện tích', 'thủ đô',
        'tổng thống', 'tại sao', 'vì sao', 'lý do', 'nguyên nhân'
      ];
      
      const isGeneralQuestion = generalQuestionPatterns.some(pattern => questionLower.includes(pattern));
      
      // Nếu là câu hỏi chung không liên quan đến tài liệu, KHÔNG coi là tham chiếu
      if (isGeneralQuestion && !hasCompanyKeyword) {
        return { resolvedQuestion: question, hasReference: false };
      }
      
      // Phân tích tài liệu từ lịch sử cuộc trò chuyện
      let lastDocumentsInHistory = [];
      let lastMentionedDocName = '';
      
      if (history.length > 0) {
        // Tìm tài liệu trong lịch sử trả lời
        const lastMessages = history.slice().reverse();
        
        // Lưu trữ danh sách tài liệu được đề cập trong cả câu hỏi và trả lời
        for (const msg of lastMessages) {
          // Kiểm tra tin nhắn trả lời
          if (msg.message_type === 'answer' && msg.relevant_documents && 
              Array.isArray(msg.relevant_documents) && msg.relevant_documents.length > 0) {
            lastDocumentsInHistory = msg.relevant_documents;
            
            // Nếu câu trả lời có nhắc đến tên tài liệu cụ thể
            const content = msg.content.toLowerCase();
            for (const doc of msg.relevant_documents) {
              if (doc.name && content.includes(doc.name.toLowerCase())) {
                lastMentionedDocName = doc.name;
                break;
              }
            }
            
            if (lastMentionedDocName || lastDocumentsInHistory.length > 0) break;
          }

          // Kiểm tra tin nhắn câu hỏi để tìm dấu hiệu của việc nói về tài liệu
          if (msg.message_type === 'question') {
            const contentLower = msg.content.toLowerCase();
            
            // Nếu câu hỏi trước đó có nói về tài liệu cụ thể
            if (contentLower.includes('tài liệu') || 
                contentLower.includes('file') || 
                contentLower.includes('document') ||
                contentLower.includes('sơ đồ') ||
                contentLower.includes('quy định')) {
              // Kiểm tra câu trả lời ngay sau câu hỏi này
              const answerIndex = lastMessages.findIndex(m => m.id === msg.id) - 1;
              if (answerIndex >= 0 && lastMessages[answerIndex].message_type === 'answer') {
                const answer = lastMessages[answerIndex];
                if (answer.relevant_documents && Array.isArray(answer.relevant_documents) && 
                    answer.relevant_documents.length > 0) {
                  if (lastDocumentsInHistory.length === 0) {
                    lastDocumentsInHistory = answer.relevant_documents;
                  }
                }
              }
            }
          }
        }
      }

      // Xác định xem câu hỏi có tham chiếu đến tài liệu không
      const hasExplicitReference = referenceKeywords.some(keyword => 
        questionLower.includes(keyword)
      );

      // Xác định tham chiếu ngữ cảnh (phải kết hợp với các điều kiện khác)
      let hasContextualReference = false;
      if (lastDocumentsInHistory.length > 0) {
        hasContextualReference = contextualKeywords.some(keyword => 
          questionLower.includes(keyword)
        );
      }
      
      // Xác định xem câu hỏi có phải là tham chiếu ngầm không
      // 1. Nếu có tài liệu trước đó và câu hỏi hiện tại ngắn
      // 2. Hoặc chứa từ khóa liên quan đến nội dung tài liệu
      // 3. Hoặc là câu hỏi tiếp theo sau khi đã hiển thị danh sách tài liệu
      const hasImplicitReference = lastDocumentsInHistory.length > 0 && (
        (question.length < 50 && 
         (questionLower.includes('chi tiết') ||
          questionLower.includes('tóm tắt') ||
          questionLower.includes('nội dung') ||
          questionLower.startsWith('trong đó'))) ||
        (history.length > 1 && 
         history[history.length-2].message_type === 'answer' &&
         history[history.length-2].content.includes('Các quy định và quy trình') &&
         questionLower.startsWith('chi tiết'))
      );

      // Thêm logic nhận diện khi người dùng hỏi về một tài liệu cụ thể 
      // mà không dùng tham chiếu trực tiếp
      let hasTopicReference = false;
      let topicReferenceScore = 0;
      
      if (lastDocumentsInHistory.length > 0) {
        for (const doc of lastDocumentsInHistory) {
          if (!doc.name) continue;
          
          // Tách tên tài liệu thành các từ khóa
          const docNameLower = doc.name.toLowerCase();
          const keyPhrases = docNameLower.split(/[\s\-\.\_\(\)]+/)
            .filter(part => part.length > 3)
            .map(part => part.replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, ''))
            .filter(part => part.length > 3);
          
          // Kiểm tra xem câu hỏi có chứa các từ khóa quan trọng trong tên tài liệu
          const topicMatches = keyPhrases.filter(phrase => questionLower.includes(phrase));
          
          let score = 0;
          
          // Nếu câu hỏi chứa ít nhất 1 từ khóa quan trọng từ tên tài liệu
          if (topicMatches.length > 0) {
            // Nếu tài liệu có từ khóa đặc biệt và câu hỏi cũng nhắc đến nó
            if ((docNameLower.includes('sơ đồ') && questionLower.includes('sơ đồ'))) {
              score += 40;
            }
            if ((docNameLower.includes('quy trình') && questionLower.includes('quy trình'))) {
              score += 40;
            }
            if ((docNameLower.includes('hướng dẫn') && questionLower.includes('hướng dẫn'))) {
              score += 40;
            }
            if ((docNameLower.includes('quy định') && questionLower.includes('quy định'))) {
              score += 40;
            }
            if ((docNameLower.includes('phap che') || docNameLower.includes('pháp chế')) && 
                (questionLower.includes('phap che') || questionLower.includes('pháp chế'))) {
              score += 50;
            }
            
            // Điểm cho số lượng từ khóa khớp
            score += topicMatches.length * 10;
          }
          
          if (score > topicReferenceScore) {
            topicReferenceScore = score;
          }
        }
        
        // Chỉ coi là tham chiếu chủ đề nếu điểm đủ cao
        hasTopicReference = topicReferenceScore >= 30;
      }

      // Loại trừ một số trường hợp câu hỏi đặc biệt không phải tham chiếu
      const nonReferencePatterns = [
        'có bao nhiêu', 'bao nhiêu', 'có mấy', 'mấy người', 
        'có ai', 'ai là', 'là ai', 'ở đâu', 'khi nào',
        'tại sao', 'vì sao', 'có phải', 'đúng không',
        'danh sách', 'liệt kê'
      ];
      
      // Nếu câu hỏi chứa các mẫu không tham chiếu và không có tham chiếu rõ ràng
      const containsNonReferencePattern = nonReferencePatterns.some(pattern => 
        questionLower.includes(pattern)
      );
      
      if (containsNonReferencePattern && !hasExplicitReference && topicReferenceScore < 50) {
        return { resolvedQuestion: question, hasReference: false };
      }

      const hasReference = hasExplicitReference || hasImplicitReference || hasTopicReference;

      // Nếu không có tham chiếu, trả về câu hỏi nguyên bản
      if (!hasReference) {
        return { resolvedQuestion: question, hasReference: false };
      }

      // Tìm tài liệu liên quan gần nhất
      let referencedDocuments = [];
      
      // Kiểm tra ngữ cảnh phiên trước
      if (context.lastRelevantDocuments && context.lastRelevantDocuments.length > 0) {
        referencedDocuments = context.lastRelevantDocuments;
      } else if (lastDocumentsInHistory.length > 0) {
        referencedDocuments = lastDocumentsInHistory;
      } else {
        // Tìm trong tin nhắn gần đây
        for (const message of history.reverse()) {
          if (message.relevant_documents && Array.isArray(message.relevant_documents)) {
            if (message.relevant_documents.length > 0) {
              referencedDocuments = message.relevant_documents;
              break;
            }
          }
        }
      }

      if (referencedDocuments.length === 0) {
        return { 
          resolvedQuestion: question, 
          hasReference: true,
          error: 'Không tìm thấy tài liệu nào được đề cập trong cuộc hội thoại trước đó.'
        };
      }
      
      // Tìm tài liệu phù hợp nhất với nội dung câu hỏi
      let matchedDocument = null;
      let highestMatchScore = 0;
      
      // Các bước chấm điểm mức độ phù hợp của tài liệu:
      // 1. Chấm điểm cho tên tài liệu hoàn chỉnh
      // 2. Chấm điểm cho từng từ khóa quan trọng trong tên tài liệu
      // 3. Chấm điểm cho các loại tài liệu đặc biệt như sơ đồ, quy trình
      // 4. Chấm điểm cho các cặp từ khóa đặc biệt (vay vốn, pháp chế...)
      // 5. Chấm điểm cho tài liệu được nhắc đến trong câu trả lời gần nhất
      for (const doc of referencedDocuments) {
        if (!doc.name) continue;
        
        const docNameLower = doc.name.toLowerCase();
        let matchScore = 0;
        
        // Tách tên tài liệu và câu hỏi thành các từ khóa
        const docNameParts = docNameLower.split(/[\s\-\.\_\(\)]+/)
          .filter(part => part.length > 3)
          .map(part => part.replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, ''))
          .filter(part => part.length > 3);
          
        // Kiểm tra tên đầy đủ
        if (questionLower.includes(docNameLower)) {
          matchScore += 100;
        }
        
        // Kiểm tra từng từ quan trọng trong tên tài liệu
        for (const part of docNameParts) {
          if (part.length > 3 && questionLower.includes(part)) {
            matchScore += 10;
          }
        }
        
        // Kiểm tra các loại tài liệu đặc biệt
        if ((docNameLower.includes('sơ đồ') && questionLower.includes('sơ đồ'))) {
          matchScore += 50;
        }
        if ((docNameLower.includes('quy trình') && questionLower.includes('quy trình'))) {
          matchScore += 50;
        }
        if ((docNameLower.includes('hướng dẫn') && questionLower.includes('hướng dẫn'))) {
          matchScore += 50;
        }
        if ((docNameLower.includes('quy định') && questionLower.includes('quy định'))) {
          matchScore += 50;
        }
        if ((docNameLower.includes('ban phap che') || docNameLower.includes('pháp chế')) && 
            (questionLower.includes('phap che') || questionLower.includes('pháp chế'))) {
          matchScore += 50;
        }
        
        // Kiểm tra các cặp từ khóa đặc biệt
        const keywordPairs = [
          { doc: 'vay von', question: 'vay vốn', score: 70 },
          { doc: 'vay vốn', question: 'vay vốn', score: 70 },
          { doc: 'phap che', question: 'pháp chế', score: 70 },
          { doc: 'pháp chế', question: 'phap che', score: 70 },
          { doc: 'chuc nang', question: 'chức năng', score: 60 },
          { doc: 'chức năng', question: 'chuc nang', score: 60 },
          { doc: 'so do', question: 'sơ đồ', score: 60 },
          { doc: 'sơ đồ', question: 'so do', score: 60 }
        ];
        
        // Tìm các cặp từ khóa đặc biệt
        for (const pair of keywordPairs) {
          if (docNameLower.includes(pair.doc) && questionLower.includes(pair.question)) {
            matchScore += pair.score;
          }
        }

        // Kiểm tra các trường hợp đặc biệt
        if ((docNameLower.includes('quy-trinh-vay-von') || docNameLower.includes('vay von') || docNameLower.includes('vay-von')) && 
            (questionLower.includes('vay vốn') || questionLower.includes('vay von'))) {
          matchScore += 80;  // Điểm cao cho sự trùng khớp này
        }
        
        // Nếu tài liệu này đã được nhắc đến trong câu trả lời gần nhất
        if (lastMentionedDocName === doc.name) {
          matchScore += 30;
        }
        
        console.log(`🔍 Đánh giá tài liệu "${doc.name}": ${matchScore} điểm`);
        
        if (matchScore > highestMatchScore) {
          highestMatchScore = matchScore;
          matchedDocument = doc;
        }
      }

      // Xây dựng câu hỏi đã giải quyết tham chiếu
      let resolvedQuestion = question;
      
      if (matchedDocument && highestMatchScore > 0) {
        // Nếu đã xác định được tài liệu cụ thể
        referenceKeywords.forEach(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
          resolvedQuestion = resolvedQuestion.replace(regex, `tài liệu "${matchedDocument.name}"`);
        });
        
        // Nếu câu hỏi chưa có sự thay đổi và có vẻ là tham chiếu ngầm
        if (resolvedQuestion === question && hasImplicitReference) {
          if (question.length < 30 || 
              questionLower.includes('chi tiết') || 
              questionLower.includes('tóm tắt')) {
            resolvedQuestion = `chi tiết về tài liệu "${matchedDocument.name}": ${question}`;
          }
        }
      } else if (referencedDocuments.length === 1) {
        // Nếu chỉ có một tài liệu trong ngữ cảnh
        const doc = referencedDocuments[0];
        referenceKeywords.forEach(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
          resolvedQuestion = resolvedQuestion.replace(regex, `tài liệu "${doc.name}"`);
        });
        
        // Xử lý trường hợp người dùng hỏi ngắn gọn
        if (resolvedQuestion === question && hasImplicitReference) {
          if (question.length < 30 || 
              questionLower.includes('chi tiết') || 
              questionLower.includes('tóm tắt')) {
            resolvedQuestion = `chi tiết về tài liệu "${doc.name}": ${question}`;
          }
        }
      } else {
        // Trường hợp nhiều tài liệu
        if (hasImplicitReference && question.length < 30) {
          // Chọn tài liệu đầu tiên nếu câu hỏi quá ngắn
          const doc = referencedDocuments[0];
          resolvedQuestion = `chi tiết về tài liệu "${doc.name}": ${question}`;
        } else if (hasExplicitReference) {
          // Dùng tài liệu đầu tiên nếu không có thông tin cụ thể hơn
          const doc = referencedDocuments[0];
          referenceKeywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            resolvedQuestion = resolvedQuestion.replace(regex, `tài liệu "${doc.name}"`);
          });
        }
      }

      console.log(`🔗 Reference resolved: "${question}" → "${resolvedQuestion}" (match score: ${highestMatchScore})`);
      
      return {
        resolvedQuestion,
        hasReference: true,
        referencedDocuments: matchedDocument ? [matchedDocument] : referencedDocuments,
        originalQuestion: question,
        matchScore: highestMatchScore
      };

    } catch (error) {
      console.error('Error resolving references:', error);
      return { resolvedQuestion: question, hasReference: false };
    }
  }

  // Expire session
  async expireSession(sessionId) {
    try {
      await pool.query(
        'UPDATE conversations SET is_active = false WHERE session_id = $1',
        [sessionId]
      );
      console.log(`⏰ Expired conversation session: ${sessionId}`);
    } catch (error) {
      console.error('Error expiring session:', error);
    }
  }

  // Clean up old conversations (run periodically)
  async cleanupOldConversations() {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const result = await pool.query(
        'UPDATE conversations SET is_active = false WHERE last_activity < $1 AND is_active = true',
        [cutoffTime]
      );

      console.log(`🧹 Cleaned up ${result.rowCount} old conversations`);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up conversations:', error);
      return 0;
    }
  }

  // Get conversation analytics
  async getConversationStats(sessionId) {
    try {
      const session = await this.getOrCreateSession(sessionId);
      
      const stats = await pool.query(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN message_type = 'question' THEN 1 END) as questions_count,
          COUNT(CASE WHEN message_type = 'answer' THEN 1 END) as answers_count,
          MIN(created_at) as first_message,
          MAX(created_at) as last_message
        FROM conversation_messages 
        WHERE conversation_id = $1
      `, [session.id]);

      return {
        sessionId,
        ...stats.rows[0],
        duration: session.last_activity - session.started_at
      };
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      return null;
    }
  }
}

module.exports = ConversationService; 