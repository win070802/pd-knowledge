const { db } = require('../../../database');

class DocumentSearchService {
  
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

  // Find relevant documents and knowledge base entries
  async findRelevantDocuments(question, limit = 5) {
    try {
      // First check knowledge base for direct answers
      const knowledgeResults = await this.searchKnowledgeBase(question);
      if (knowledgeResults.length > 0) {
        console.log(`📚 Found ${knowledgeResults.length} knowledge base entries`);
        return knowledgeResults.slice(0, limit);
      }

      // Simple keyword search - can be improved with vector search
      const keywords = question.toLowerCase().split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 5);
      
      const documents = await db.getDocuments();
      const relevantDocs = [];
      const seenContent = new Set(); // For deduplication
      
      for (const doc of documents) {
        if (!doc.content_text) continue;
        
        const content = doc.content_text.toLowerCase();
        
        // Skip duplicates based on content similarity (first 200 chars)
        const contentFingerprint = content.substring(0, 200);
        if (seenContent.has(contentFingerprint)) {
          console.log(`🔄 Skipping duplicate document: ${doc.original_name}`);
          continue;
        }
        seenContent.add(contentFingerprint);
        
        let relevanceScore = 0;
        let keywordCount = 0;
        
        for (const keyword of keywords) {
          const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
          relevanceScore += matches;
          if (matches > 0) keywordCount++;
        }
        
        // Boost score for documents that have more different keywords
        // This helps prioritize documents with diverse keyword coverage
        if (keywordCount > 0) {
          const keywordDiversityBonus = keywordCount * 2;
          const finalScore = relevanceScore + keywordDiversityBonus;
          relevantDocs.push({ ...doc, relevanceScore: finalScore, originalScore: relevanceScore, keywordCount });
        }
      }
      
      return relevantDocs
        .sort((a, b) => {
          // Primary sort by relevance score
          if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
          // Secondary sort by keyword diversity
          return b.keywordCount - a.keywordCount;
        })
        .slice(0, Math.max(limit, 10)); // Ensure we get at least 10 results
    } catch (error) {
      console.error('Error finding relevant documents:', error);
      throw error;
    }
  }

  // Search knowledge base for relevant entries
  async searchKnowledgeBase(question) {
    try {
      const keywords = question.toLowerCase().split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 5);
      
      let allResults = [];
      
      // Search each keyword
      for (const keyword of keywords) {
        const results = await db.searchKnowledge(keyword);
        allResults = allResults.concat(results);
      }
      
      // Remove duplicates and calculate relevance
      const uniqueResults = [];
      const seenIds = new Set();
      
      for (const result of allResults) {
        if (!seenIds.has(result.id)) {
          seenIds.add(result.id);
          
          // Calculate relevance score
          let relevanceScore = 0;
          const content = (result.question + ' ' + result.answer).toLowerCase();
          
          for (const keyword of keywords) {
            const matches = (content.match(new RegExp(keyword, 'g')) || []).length;
            relevanceScore += matches;
          }
          
          uniqueResults.push({
            ...result,
            relevanceScore,
            isKnowledgeBase: true
          });
        }
      }
      
      return uniqueResults
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      return [];
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
}

module.exports = DocumentSearchService; 