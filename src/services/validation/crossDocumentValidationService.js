const EntityExtractionService = require('../ai/entityExtractionService');
const { db } = require('../../../database');
const { pool } = require('../../config/database');

class CrossDocumentValidationService {
  constructor() {
    this.entityExtractor = new EntityExtractionService();
  }

  // Main method: Cross-validate new document with existing ones
  async validateAndCorrectDocument(documentId, text, filename, companyId) {
    try {
      console.log(`🔄 Starting cross-document validation for ${filename} (Company: ${companyId})`);
      
      // Step 1: Extract entities from new document
      const newEntities = await this.entityExtractor.extractEntities(text, filename, companyId);
      
      // Step 2: Get existing documents from same company
      const existingDocuments = await this.getRelatedDocuments(companyId, documentId);
      console.log(`📚 Found ${existingDocuments.length} related documents for comparison`);
      
      if (existingDocuments.length === 0) {
        // First document - just store entities
        await this.storeDocumentEntities(documentId, newEntities);
        return {
          originalText: text,
          correctedText: text,
          entities: newEntities,
          corrections: [],
          conflicts: [],
          confidence: 1.0
        };
      }
      
      // Step 3: Extract entities from existing documents
      const existingEntities = await this.extractEntitiesFromDocuments(existingDocuments);
      
      // Step 4: Compare and find conflicts/corrections
      const comparison = await this.entityExtractor.compareEntities(
        newEntities, 
        existingEntities,
        {
          new: filename,
          existing: existingDocuments.map(d => d.original_name)
        }
      );
      
      // Step 5: Apply corrections to text
      const correctionResult = await this.applyCorrections(text, comparison.corrections);
      
      // Step 6: Merge entities and generate metadata
      const mergedEntities = await this.mergeEntities(newEntities, existingEntities, comparison);
      
      // Step 7: Store results
      await this.storeDocumentEntities(documentId, mergedEntities);
      await this.updateCompanyMetadata(companyId, mergedEntities, [...existingDocuments, { id: documentId, original_name: filename }]);
      
      return {
        originalText: text,
        correctedText: correctionResult.correctedText,
        entities: mergedEntities,
        corrections: comparison.corrections,
        conflicts: comparison.conflicts,
        confidence: correctionResult.confidence
      };
      
    } catch (error) {
      console.error('❌ Error in cross-document validation:', error);
      return {
        originalText: text,
        correctedText: text,
        entities: this.entityExtractor.getEmptyEntities(),
        corrections: [],
        conflicts: [],
        confidence: 0.5
      };
    }
  }

  // Get documents from same company for comparison
  async getRelatedDocuments(companyId, excludeDocumentId) {
    try {
      const documents = await db.getDocuments();
      return documents.filter(doc => 
        doc.company_id === companyId && 
        doc.id !== excludeDocumentId &&
        doc.content_text && 
        doc.content_text.length > 100
      );
    } catch (error) {
      console.error('❌ Error getting related documents:', error);
      return [];
    }
  }

  // Extract entities from multiple existing documents
  async extractEntitiesFromDocuments(documents) {
    const allEntities = this.entityExtractor.getEmptyEntities();
    
    for (const doc of documents.slice(0, 5)) { // Limit to 5 documents for performance
      try {
        const entities = await this.entityExtractor.extractEntities(
          doc.content_text, 
          doc.original_name, 
          doc.company_id
        );
        
        // Merge entities
        Object.keys(entities).forEach(key => {
          if (Array.isArray(entities[key])) {
            allEntities[key] = [...allEntities[key], ...entities[key]];
          }
        });
        
      } catch (error) {
        console.error(`❌ Error extracting entities from ${doc.original_name}:`, error);
      }
    }
    
    return allEntities;
  }

  // Apply OCR corrections to text
  async applyCorrections(originalText, corrections) {
    let correctedText = originalText;
    let totalConfidence = 0;
    let correctionCount = 0;
    
    for (const correction of corrections) {
      if (correction.confidence >= 0.8) {
        // Apply correction
        const regex = new RegExp(correction.originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        correctedText = correctedText.replace(regex, correction.correctedText);
        
        totalConfidence += correction.confidence;
        correctionCount++;
        
        console.log(`✅ Applied correction: "${correction.originalText}" → "${correction.correctedText}" (confidence: ${correction.confidence})`);
      }
    }
    
    const confidence = correctionCount > 0 ? totalConfidence / correctionCount : 1.0;
    
    return {
      correctedText,
      confidence,
      correctionsApplied: correctionCount
    };
  }

  // Merge entities from different sources
  async mergeEntities(newEntities, existingEntities, comparison) {
    const merged = JSON.parse(JSON.stringify(newEntities)); // Deep copy
    
    // Apply recommended merges from comparison
    for (const similarity of comparison.similarities) {
      if (similarity.confidence >= 0.9 && similarity.isExactMatch) {
        // Entities are the same - no need to duplicate
        console.log(`🔄 Merged similar entities: ${similarity.matchedEntities.join(' = ')}`);
      }
    }
    
    // Resolve conflicts based on recommendations
    for (const conflict of comparison.conflicts) {
      if (conflict.confidence >= 0.8) {
        if (conflict.recommendation === 'use_existing') {
          // Keep existing value
          console.log(`🔄 Resolved conflict: kept existing "${conflict.existingValue}" over "${conflict.newValue}"`);
        } else if (conflict.recommendation === 'use_new') {
          // Use new value (already in merged)
          console.log(`🔄 Resolved conflict: used new "${conflict.newValue}" over "${conflict.existingValue}"`);
        }
      }
    }
    
    return merged;
  }

  // Store document entities in database
  async storeDocumentEntities(documentId, entities) {
    try {
      // Store entities as JSON in document_metadata table
      await pool.query(
        `INSERT INTO document_metadata (document_id, entities, created_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (document_id) DO UPDATE SET 
         entities = $2, updated_at = NOW()`,
        [documentId, JSON.stringify(entities)]
      );
      
      console.log(`💾 Stored entities for document ${documentId}`);
    } catch (error) {
      console.error('❌ Error storing document entities:', error);
    }
  }

  // Update company-wide metadata
  async updateCompanyMetadata(companyId, mergedEntities, documents) {
    try {
      const standardizedMetadata = await this.entityExtractor.generateStandardizedMetadata(
        mergedEntities, 
        companyId, 
        documents
      );
      
      // Store company metadata
      await pool.query(
        `INSERT INTO company_metadata (company_id, metadata, created_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (company_id) DO UPDATE SET 
         metadata = $2, updated_at = NOW()`,
        [companyId, JSON.stringify(standardizedMetadata)]
      );
      
      console.log(`📊 Updated company metadata for ${companyId}`);
      return standardizedMetadata;
      
    } catch (error) {
      console.error('❌ Error updating company metadata:', error);
      return null;
    }
  }

  // Get company metadata
  async getCompanyMetadata(companyId) {
    try {
      const result = await pool.query(
        'SELECT metadata FROM company_metadata WHERE company_id = $1',
        [companyId]
      );
      
      if (result.rows.length > 0) {
        return JSON.parse(result.rows[0].metadata);
      }
      
      return this.entityExtractor.getEmptyMetadata(companyId);
    } catch (error) {
      console.error('❌ Error getting company metadata:', error);
      return this.entityExtractor.getEmptyMetadata(companyId);
    }
  }

  // Search for entity across all documents
  async searchEntityAcrossDocuments(entityName, entityType, companyId = null) {
    try {
      let query = `
        SELECT d.*, dm.entities 
        FROM documents d 
        LEFT JOIN document_metadata dm ON d.id = dm.document_id 
        WHERE dm.entities::text ILIKE $1
      `;
      const params = [`%${entityName}%`];
      
      if (companyId) {
        query += ' AND d.company_id = $2';
        params.push(companyId);
      }
      
      const result = await pool.query(query, params);
      
      const matches = [];
      for (const row of result.rows) {
        if (row.entities) {
          const entities = JSON.parse(row.entities);
          
          // Search in specific entity type
          if (entities[entityType]) {
            const found = entities[entityType].filter(entity => 
              JSON.stringify(entity).toLowerCase().includes(entityName.toLowerCase())
            );
            
            if (found.length > 0) {
              matches.push({
                document: row.original_name,
                documentId: row.id,
                entities: found,
                type: entityType
              });
            }
          }
        }
      }
      
      return matches;
    } catch (error) {
      console.error('❌ Error searching entity across documents:', error);
      return [];
    }
  }
}

module.exports = CrossDocumentValidationService; 