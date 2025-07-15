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

  // Resolve references in question (e.g., "tài liệu đó", "file này")
  async resolveReferences(sessionId, question) {
    try {
      // Get session context directly without creating new session
      const sessionQuery = await pool.query(
        'SELECT context FROM conversations WHERE session_id = $1 AND is_active = true',
        [sessionId]
      );
      
      const context = sessionQuery.rows.length > 0 ? sessionQuery.rows[0].context : {};
      const history = await this.getConversationHistory(sessionId, 5);

      // Check for reference keywords
      const referenceKeywords = [
        'tài liệu đó', 'document đó', 'file đó', 'quy định đó',
        'tài liệu này', 'document này', 'file này', 'quy định này',
        'tài liệu trước', 'file trước', 'cái đó', 'cái này',
        'nó', 'đó', 'này'
      ];

      const questionLower = question.toLowerCase();
      const hasReference = referenceKeywords.some(keyword => 
        questionLower.includes(keyword)
      );

      if (!hasReference) {
        return { resolvedQuestion: question, hasReference: false };
      }

      // Find most recent relevant documents
      let referencedDocuments = [];
      
      // Check session context first
      if (context.lastRelevantDocuments && context.lastRelevantDocuments.length > 0) {
        referencedDocuments = context.lastRelevantDocuments;
      } else {
        // Check recent messages for documents
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

      // Replace references with specific document names
      let resolvedQuestion = question;
      
      if (referencedDocuments.length === 1) {
        const doc = referencedDocuments[0];
        referenceKeywords.forEach(keyword => {
          const regex = new RegExp(keyword, 'gi');
          resolvedQuestion = resolvedQuestion.replace(regex, `tài liệu "${doc.name}"`);
        });
      } else {
        // Multiple documents - use first one or ask for clarification
        const doc = referencedDocuments[0];
        referenceKeywords.forEach(keyword => {
          const regex = new RegExp(keyword, 'gi');
          resolvedQuestion = resolvedQuestion.replace(regex, `tài liệu "${doc.name}"`);
        });
      }

      console.log(`🔗 Reference resolved: "${question}" → "${resolvedQuestion}"`);
      
      return {
        resolvedQuestion,
        hasReference: true,
        referencedDocuments,
        originalQuestion: question
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