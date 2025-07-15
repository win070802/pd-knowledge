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

  // Search knowledge base for relevant entries with synonym support
  async searchKnowledgeBase(question) {
    try {
      // Expand keywords with synonyms
      const expandedKeywords = this.expandWithSynonyms(question);
      
      let allResults = [];
      
      // Search each expanded keyword
      for (const keyword of expandedKeywords) {
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
          
          for (const keyword of expandedKeywords) {
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

  // Expand keywords with synonyms for better matching
  expandWithSynonyms(question) {
    const questionLower = question.toLowerCase();
    
    // Synonym mapping for Vietnamese terms
    const synonymMap = {
      // Team/Department terms
      'team': ['team', 'ban', 'phòng', 'bộ phận', 'nhóm', 'đội'],
      'ban': ['ban', 'team', 'phòng', 'bộ phận', 'nhóm'],
      'phòng': ['phòng', 'ban', 'team', 'bộ phận'],
      'bộ phận': ['bộ phận', 'ban', 'team', 'phòng'],
      
      // IT terms
      'it': ['it', 'công nghệ thông tin', 'cntt', 'technology'],
      'công nghệ thông tin': ['công nghệ thông tin', 'it', 'cntt'],
      'cntt': ['cntt', 'it', 'công nghệ thông tin'],
      
      // Count terms  
      'mấy': ['mấy', 'bao nhiêu', 'số lượng', 'how many'],
      'bao nhiêu': ['bao nhiêu', 'mấy', 'số lượng'],
      'người': ['người', 'thành viên', 'nhân viên', 'member'],
      'thành viên': ['thành viên', 'người', 'nhân viên', 'member'],
      
      // Question terms
      'có ai': ['có ai', 'những ai', 'gồm ai', 'danh sách'],
      'những ai': ['những ai', 'có ai', 'gồm ai', 'danh sách'],
      'gồm có': ['gồm có', 'bao gồm', 'có', 'gồm'],
      
      // Role terms
      'làm gì': ['làm gì', 'vai trò', 'chức vụ', 'vị trí', 'công việc'],
      'vai trò': ['vai trò', 'làm gì', 'chức vụ', 'vị trí'],
      'chức vụ': ['chức vụ', 'vai trò', 'làm gì', 'vị trí']
    };
    
    let allKeywords = [];
    
    // Extract base keywords
    const baseKeywords = questionLower.split(/\s+/)
      .filter(word => word.length > 1)
      .slice(0, 8);
    
    // Add base keywords
    allKeywords = allKeywords.concat(baseKeywords);
    
    // Add synonyms
    for (const keyword of baseKeywords) {
      if (synonymMap[keyword]) {
        allKeywords = allKeywords.concat(synonymMap[keyword]);
      }
    }
    
    // Add phrase synonyms
    Object.keys(synonymMap).forEach(phrase => {
      if (questionLower.includes(phrase)) {
        allKeywords = allKeywords.concat(synonymMap[phrase]);
      }
    });
    
    // Remove duplicates and filter
    return [...new Set(allKeywords)]
      .filter(word => word.length > 1)
      .slice(0, 15); // Limit to prevent too many searches
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

  // Search documents by text query
  async searchDocuments(searchTerm, companyCode = null) {
    try {
      console.log(`📄 Searching documents for: "${searchTerm}" (company: ${companyCode || 'all'})`);
      
      // Use existing db.searchDocuments method
      let documents = await db.searchDocuments(searchTerm);
      
      // Filter by company if specified
      if (companyCode) {
        documents = documents.filter(doc => 
          doc.company_id === companyCode || 
          doc.original_name.toUpperCase().includes(companyCode.toUpperCase())
        );
      }
      
      console.log(`📄 Found ${documents.length} documents`);
      return documents;
      
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }
}

module.exports = DocumentSearchService; 