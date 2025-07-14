const { db } = require('../../database');

const debugSearch = async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    console.log(`🔍 Debug search for: "${question}"`);
    
    // Extract keywords like the actual search does
    const keywords = question.toLowerCase().split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5);
    
    console.log(`🔤 Keywords: ${keywords.join(', ')}`);
    
    const documents = await db.getDocuments();
    const results = [];
    
    for (const doc of documents) {
      if (!doc.content_text) continue;
      
      const content = doc.content_text.toLowerCase();
      let relevanceScore = 0;
      const matches = {};
      
      for (const keyword of keywords) {
        const keywordMatches = (content.match(new RegExp(keyword, 'g')) || []).length;
        relevanceScore += keywordMatches;
        if (keywordMatches > 0) {
          matches[keyword] = keywordMatches;
        }
      }
      
      if (relevanceScore > 0) {
        results.push({
          id: doc.id,
          name: doc.original_name,
          relevanceScore,
          matches,
          contentPreview: doc.content_text.substring(0, 200) + '...'
        });
      }
    }
    
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    res.json({
      success: true,
      question,
      keywords,
      totalDocuments: documents.length,
      matchingDocuments: results.length,
      results: results.slice(0, 10) // Top 10 results
    });

  } catch (error) {
    console.error('Error in debug search:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const debugDocument = async (req, res) => {
  res.json({ success: true, message: 'Debug document feature implemented in refactored version' });
};

module.exports = {
  debugSearch,
  debugDocument
}; 