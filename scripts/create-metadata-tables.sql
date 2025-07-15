-- Create tables for cross-document validation and metadata storage

-- Document metadata table to store extracted entities
CREATE TABLE IF NOT EXISTS document_metadata (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE UNIQUE,
    entities JSONB NOT NULL DEFAULT '{}',
    validation_results JSONB DEFAULT '{}',
    correction_count INTEGER DEFAULT 0,
    confidence_score DECIMAL(3,2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Company metadata table to store standardized company-wide information
CREATE TABLE IF NOT EXISTS company_metadata (
    id SERIAL PRIMARY KEY,
    company_id VARCHAR(10) UNIQUE NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    entity_count INTEGER DEFAULT 0,
    last_validation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cross-validation logs for tracking corrections and conflicts
CREATE TABLE IF NOT EXISTS validation_logs (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    validation_type VARCHAR(50) NOT NULL, -- 'entity_extraction', 'cross_validation', 'ocr_correction'
    original_text TEXT,
    corrected_text TEXT,
    entities_found JSONB DEFAULT '{}',
    corrections_applied JSONB DEFAULT '[]',
    conflicts_resolved JSONB DEFAULT '[]',
    confidence_score DECIMAL(3,2) DEFAULT 0.0,
    processing_time_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Entity references table for fast cross-document entity lookup
CREATE TABLE IF NOT EXISTS entity_references (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL, -- 'people', 'departments', 'policies', etc.
    entity_name VARCHAR(255) NOT NULL,
    entity_value TEXT,
    confidence_score DECIMAL(3,2) DEFAULT 0.0,
    occurrences INTEGER DEFAULT 1,
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_metadata_document_id ON document_metadata(document_id);
CREATE INDEX IF NOT EXISTS idx_company_metadata_company_id ON company_metadata(company_id);
CREATE INDEX IF NOT EXISTS idx_validation_logs_document_id ON validation_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_validation_logs_type ON validation_logs(validation_type);
CREATE INDEX IF NOT EXISTS idx_entity_references_entity_type ON entity_references(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_references_entity_name ON entity_references(entity_name);
CREATE INDEX IF NOT EXISTS idx_entity_references_document_id ON entity_references(document_id);

-- Add JSONB indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_document_metadata_entities_gin ON document_metadata USING GIN (entities);
CREATE INDEX IF NOT EXISTS idx_company_metadata_gin ON company_metadata USING GIN (metadata);

-- Add triggers to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_metadata_updated_at 
    BEFORE UPDATE ON document_metadata 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_metadata_updated_at 
    BEFORE UPDATE ON company_metadata 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entity_references_updated_at 
    BEFORE UPDATE ON entity_references 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE document_metadata IS 'Stores extracted entities and validation results for each document';
COMMENT ON TABLE company_metadata IS 'Stores standardized company-wide metadata aggregated from all documents';
COMMENT ON TABLE validation_logs IS 'Logs all validation activities for auditing and debugging';
COMMENT ON TABLE entity_references IS 'Fast lookup table for entities across all documents'; 