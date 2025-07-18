const { pool } = require('../../src/config/database');
const fs = require('fs');
const path = require('path');

/**
 * Xóa và tạo lại các bảng liên quan đến tài liệu và công ty
 */
async function recreateDocumentTables() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Bắt đầu xóa và tạo lại các bảng tài liệu và công ty...');
    
    // Bắt đầu transaction
    await client.query('BEGIN');
    
    // 1. Xóa các bảng liên quan đến tài liệu và công ty
    console.log('🗑️ Đang xóa các bảng liên quan...');
    
    // Xóa các bảng phụ thuộc trước
    const dropTables = [
      'entity_references',
      'validation_logs',
      'document_metadata',
      'company_metadata',
      'document_chunks',
      'knowledge_base',
      'knowledge',
      'documents',
      'departments',
      'companies'
    ];
    
    for (const table of dropTables) {
      try {
        await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        console.log(`✅ Đã xóa bảng ${table}`);
      } catch (error) {
        console.error(`❌ Lỗi khi xóa bảng ${table}:`, error.message);
      }
    }
    
    // 2. Tạo các extension cần thiết
    console.log('🧩 Đang tạo các extension cần thiết...');
    
    try {
      // Tạo extension cho UUID
      await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      console.log('✅ Đã tạo extension uuid-ossp');
      
      // Tạo extension cho vector search (cần cài đặt pgvector)
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('✅ Đã tạo extension vector');
      
      // Tạo extension cho full-text search
      await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      console.log('✅ Đã tạo extension pg_trgm');
    } catch (error) {
      console.error('❌ Lỗi khi tạo extensions:', error.message);
      console.log('⚠️ Tiếp tục quá trình tạo bảng...');
    }
    
    // 3. Tạo bảng companies
    console.log('📊 Đang tạo bảng companies...');
    
    await client.query(`
      CREATE TABLE companies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          
          -- Thông tin cơ bản
          company_code VARCHAR(20) UNIQUE NOT NULL,
          company_name VARCHAR(255) NOT NULL,
          company_name_en VARCHAR(255),
          short_name VARCHAR(100),
          
          -- Thông tin pháp lý
          legal_form VARCHAR(50), -- Công ty CP, TNHH, v.v.
          tax_code VARCHAR(20) UNIQUE,
          business_license VARCHAR(50),
          
          -- Địa chỉ
          headquarters_address TEXT,
          postal_code VARCHAR(10),
          city VARCHAR(100),
          province VARCHAR(100),
          country VARCHAR(100) DEFAULT 'Vietnam',
          
          -- Liên hệ
          phone VARCHAR(20),
          fax VARCHAR(20),
          email VARCHAR(100),
          website VARCHAR(255),
          
          -- Thông tin doanh nghiệp
          industry VARCHAR(100),
          business_type VARCHAR(50), -- Parent, Subsidiary, Partner, etc.
          parent_company_id UUID REFERENCES companies(id),
          
          -- Thông tin tài chính
          registered_capital DECIMAL(20,2),
          charter_capital DECIMAL(20,2),
          currency_code VARCHAR(3) DEFAULT 'VND',
          fiscal_year_end DATE,
          
          -- Thông tin quản trị
          legal_representative VARCHAR(100),
          ceo VARCHAR(100),
          chairman VARCHAR(100),
          
          -- Metadata
          status VARCHAR(20) DEFAULT 'active', -- active, inactive, dissolved
          established_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(100),
          updated_by VARCHAR(100),
          
          -- Thông tin bổ sung
          description TEXT,
          tags TEXT[], -- Array of tags
          custom_fields JSONB, -- Flexible fields for additional data
          
          -- Các trường bổ sung từ INSERT statement
          document_naming_convention VARCHAR(100),
          default_retention_policy JSONB,
          document_approval_workflow JSONB,
          security_policies JSONB,
          compliance_requirements TEXT[],
          departments JSONB,
          business_functions JSONB,
          document_categories JSONB,
          workflow_templates JSONB,
          supported_languages TEXT[],
          company_branding JSONB
      )
    `);
    console.log('✅ Đã tạo bảng companies');
    
    // 4. Tạo bảng document_metadata
    console.log('📊 Đang tạo bảng document_metadata...');
    
    await client.query(`
      CREATE TABLE document_metadata (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          
          -- ============== DUBLIN CORE METADATA (ISO 15836) ==============
          -- Thông tin cơ bản
          dc_identifier VARCHAR(255) UNIQUE NOT NULL,
          dc_title VARCHAR(500) NOT NULL,
          dc_description TEXT,
          dc_type VARCHAR(100) NOT NULL, -- Contract, Policy, Procedure, Report, etc.
          dc_format VARCHAR(100), -- PDF, DOCX, etc.
          dc_language VARCHAR(10) DEFAULT 'vi',
          dc_source VARCHAR(255),
          dc_rights TEXT,
          
          -- Người tạo và đóng góp
          dc_creator TEXT[], -- Array of creators
          dc_contributor TEXT[], -- Array of contributors
          dc_publisher VARCHAR(255),
          
          -- Chủ đề và phân loại
          dc_subject TEXT[], -- Array of subjects
          dc_relation TEXT[], -- Array of related resources
          
          -- Thời gian và địa điểm
          dc_date TIMESTAMP NOT NULL,
          dc_coverage_spatial VARCHAR(255),
          dc_coverage_temporal VARCHAR(255),
          
          -- ============== RECORDS MANAGEMENT (ISO 23081) ==============
          record_identifier VARCHAR(255) UNIQUE NOT NULL,
          record_class VARCHAR(100) NOT NULL,
          record_status VARCHAR(20) DEFAULT 'active', -- active, inactive, disposed, destroyed
          
          -- Lưu trữ và bảo quản
          retention_period INTEGER, -- Thời hạn lưu trữ (năm)
          retention_trigger VARCHAR(100), -- Sự kiện kích hoạt
          disposal_action VARCHAR(50), -- destroy, transfer, review
          
          -- Bảo mật
          security_classification VARCHAR(20) DEFAULT 'internal', -- public, internal, confidential, secret, top-secret
          access_conditions TEXT,
          access_restrictions TEXT[],
          authorized_users TEXT[],
          
          -- Quản lý lưu trữ
          custodian VARCHAR(100),
          storage_location VARCHAR(255),
          storage_format VARCHAR(100),
          technical_requirements TEXT,
          
          -- ============== BUSINESS PROCESS METADATA ==============
          -- Thông tin tổ chức
          company_id UUID REFERENCES companies(id),
          organization_name VARCHAR(255),
          organization_code VARCHAR(50),
          department VARCHAR(100),
          business_function VARCHAR(100),
          
          -- Quy trình làm việc
          workflow_process_name VARCHAR(255),
          workflow_process_owner VARCHAR(100),
          workflow_current_stage VARCHAR(100),
          workflow_approval_required BOOLEAN DEFAULT false,
          workflow_approvers TEXT[],
          workflow_escalation_path TEXT[],
          
          -- Tuân thủ
          regulatory_requirements TEXT[],
          compliance_status VARCHAR(50),
          audit_trail JSONB, -- Array of audit events
          
          -- ============== LIFECYCLE MANAGEMENT ==============
          -- Phiên bản
          version_major INTEGER DEFAULT 1,
          version_minor INTEGER DEFAULT 0,
          version_patch INTEGER DEFAULT 0,
          version_history JSONB, -- Array of version history
          
          -- Ngày tháng quan trọng
          date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          date_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          date_published TIMESTAMP,
          date_effective TIMESTAMP,
          date_expires TIMESTAMP,
          date_review TIMESTAMP,
          
          -- Trạng thái tài liệu
          document_state VARCHAR(20) DEFAULT 'draft', -- draft, review, approved, published, withdrawn, superseded
          state_transitions JSONB, -- Array of state transitions
          
          -- ============== TECHNICAL METADATA ==============
          -- Thông tin file
          file_size BIGINT,
          file_checksum VARCHAR(255),
          checksum_algorithm VARCHAR(50),
          file_encoding VARCHAR(50),
          mime_type VARCHAR(100),
          
          -- Lưu trữ kỹ thuật
          primary_location VARCHAR(500),
          backup_locations TEXT[],
          storage_class VARCHAR(50),
          encryption_status BOOLEAN DEFAULT false,
          encryption_algorithm VARCHAR(100),
          
          -- Bảo quản số
          preservation_level VARCHAR(50),
          migration_history TEXT[],
          integrity_checks JSONB,
          
          -- ============== SEARCH AND DISCOVERY ==============
          keywords TEXT[], -- Keywords for search
          categories TEXT[], -- Hierarchical categories
          tags TEXT[], -- User-defined tags
          search_terms_stemmed TEXT[],
          search_terms_synonyms TEXT[],
          search_terms_translations JSONB,
          
          -- ============== QUALITY AND ANALYTICS ==============
          -- Validation
          validation_date TIMESTAMP,
          validator VARCHAR(100),
          validation_status VARCHAR(50),
          validation_errors TEXT[],
          
          -- Usage statistics
          access_count INTEGER DEFAULT 0,
          download_count INTEGER DEFAULT 0,
          last_accessed TIMESTAMP,
          popular_sections TEXT[],
          
          -- Feedback
          average_rating DECIMAL(3,2),
          review_count INTEGER DEFAULT 0,
          comments JSONB,
          
          -- ============== RELATIONSHIPS ==============
          -- Hierarchical relationships
          parent_document_id UUID REFERENCES document_metadata(id),
          child_document_ids UUID[],
          sibling_document_ids UUID[],
          
          -- Associative relationships
          doc_references UUID[], -- Documents this document references (renamed from 'references')
          referenced_by UUID[], -- Documents that reference this document
          related_to UUID[], -- Related documents
          
          -- Temporal relationships
          supersedes UUID[], -- Documents this document supersedes
          superseded_by UUID REFERENCES document_metadata(id),
          based_on UUID[], -- Documents this is based on
          
          -- ============== METADATA MANAGEMENT ==============
          created_by VARCHAR(100),
          updated_by VARCHAR(100),
          metadata_version INTEGER DEFAULT 1,
          
          -- OCR specific fields
          ocr_confidence DECIMAL(5,2), -- OCR confidence score
          ocr_engine VARCHAR(50), -- OCR engine used
          ocr_date TIMESTAMP, -- When OCR was performed
          text_extraction_quality VARCHAR(20), -- excellent, good, fair, poor
          
          -- Full-text search
          document_text_tsv TSVECTOR, -- For PostgreSQL full-text search
          
          -- ============== Q&A AND SEMANTIC SEARCH ==============
          -- Document content for Q&A
          extracted_text TEXT, -- Full extracted text from OCR
          document_summary TEXT, -- Executive summary/abstract
          key_information JSONB, -- Structured key info (dates, amounts, parties, etc.)
          
          -- Semantic embeddings for vector search
          title_embedding VECTOR(1536), -- OpenAI embedding for title
          content_embedding VECTOR(1536), -- OpenAI embedding for content
          summary_embedding VECTOR(1536), -- OpenAI embedding for summary
          
          -- Question-Answer pairs
          predefined_qas JSONB, -- Pre-defined Q&A pairs
          
          -- Structured data extraction
          entities JSONB, -- Named entities (persons, organizations, locations, etc.)
          
          -- Key-value pairs for structured queries
          key_values JSONB, -- Structured key-value data
          
          -- Document sections for precise answers
          document_sections JSONB, -- Document structure with content
          
          -- FAQ and common questions
          common_questions JSONB, -- Frequently asked questions about this document
          question_patterns JSONB, -- Pattern matching for questions
          
          -- Contextual information
          document_context JSONB, -- Related context for better Q&A
          
          -- Multi-modal content
          images_metadata JSONB, -- Information about images, charts, tables
          tables_data JSONB, -- Extracted table data
          charts_data JSONB, -- Chart and graph data
          
          -- Language processing
          language_detected VARCHAR(10), -- Auto-detected language
          translation_available JSONB, -- Available translations
          sentiment_analysis JSONB, -- Document sentiment if applicable
          
          -- Custom fields for flexibility
          custom_metadata JSONB
      )
    `);
    console.log('✅ Đã tạo bảng document_metadata');
    
    // 5. Tạo các indexes
    console.log('📊 Đang tạo các indexes...');
    
    // Companies indexes
    await client.query('CREATE INDEX idx_companies_code ON companies(company_code)');
    await client.query('CREATE INDEX idx_companies_name ON companies(company_name)');
    await client.query('CREATE INDEX idx_companies_parent ON companies(parent_company_id)');
    await client.query('CREATE INDEX idx_companies_status ON companies(status)');
    
    // Document metadata indexes
    await client.query('CREATE INDEX idx_doc_meta_identifier ON document_metadata(dc_identifier)');
    await client.query('CREATE INDEX idx_doc_meta_record_id ON document_metadata(record_identifier)');
    await client.query('CREATE INDEX idx_doc_meta_company ON document_metadata(company_id)');
    await client.query('CREATE INDEX idx_doc_meta_type ON document_metadata(dc_type)');
    await client.query('CREATE INDEX idx_doc_meta_status ON document_metadata(record_status)');
    await client.query('CREATE INDEX idx_doc_meta_state ON document_metadata(document_state)');
    await client.query('CREATE INDEX idx_doc_meta_created ON document_metadata(date_created)');
    await client.query('CREATE INDEX idx_doc_meta_effective ON document_metadata(date_effective)');
    await client.query('CREATE INDEX idx_doc_meta_expires ON document_metadata(date_expires)');
    await client.query('CREATE INDEX idx_doc_meta_security ON document_metadata(security_classification)');
    
    // GIN indexes for arrays and JSONB
    await client.query('CREATE INDEX idx_doc_meta_keywords ON document_metadata USING GIN(keywords)');
    await client.query('CREATE INDEX idx_doc_meta_tags ON document_metadata USING GIN(tags)');
    await client.query('CREATE INDEX idx_doc_meta_categories ON document_metadata USING GIN(categories)');
    await client.query('CREATE INDEX idx_doc_meta_custom ON document_metadata USING GIN(custom_metadata)');
    await client.query('CREATE INDEX idx_doc_meta_tsv ON document_metadata USING GIN(document_text_tsv)');
    
    // Indexes for Q&A and semantic search
    await client.query('CREATE INDEX idx_doc_meta_entities ON document_metadata USING GIN(entities)');
    await client.query('CREATE INDEX idx_doc_meta_key_values ON document_metadata USING GIN(key_values)');
    await client.query('CREATE INDEX idx_doc_meta_qas ON document_metadata USING GIN(predefined_qas)');
    await client.query('CREATE INDEX idx_doc_meta_sections ON document_metadata USING GIN(document_sections)');
    
    // Vector similarity search indexes (requires pgvector extension)
    try {
      await client.query('CREATE INDEX idx_doc_meta_title_embedding ON document_metadata USING ivfflat (title_embedding vector_cosine_ops)');
      await client.query('CREATE INDEX idx_doc_meta_content_embedding ON document_metadata USING ivfflat (content_embedding vector_cosine_ops)');
      await client.query('CREATE INDEX idx_doc_meta_summary_embedding ON document_metadata USING ivfflat (summary_embedding vector_cosine_ops)');
      console.log('✅ Đã tạo các vector search indexes');
    } catch (error) {
      console.error('❌ Lỗi khi tạo vector search indexes:', error.message);
      console.log('⚠️ Tiếp tục quá trình tạo triggers...');
    }
    
    // 6. Tạo triggers
    console.log('🔄 Đang tạo triggers...');
    
    // Update modified timestamp for companies
    await client.query(`
      CREATE OR REPLACE FUNCTION update_modified_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE TRIGGER companies_update_timestamp
          BEFORE UPDATE ON companies
          FOR EACH ROW
          EXECUTE FUNCTION update_modified_timestamp();
    `);
    
    // Update document modified timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION update_document_modified_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.date_modified = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      CREATE TRIGGER document_metadata_update_timestamp
          BEFORE UPDATE ON document_metadata
          FOR EACH ROW
          EXECUTE FUNCTION update_document_modified_timestamp();
    `);
    
    // 7. Thêm dữ liệu mẫu
    console.log('📝 Đang thêm dữ liệu mẫu...');
    
    // Thêm dữ liệu mẫu cho companies
    await client.query(`
      INSERT INTO companies (
          company_code, company_name, company_name_en, short_name,
          legal_form, tax_code, business_license,
          headquarters_address, city, province,
          phone, email, website,
          industry, business_type,
          registered_capital, charter_capital, currency_code,
          legal_representative, ceo, chairman,
          status, established_date,
          created_by, description,
          document_naming_convention, default_retention_policy,
          document_approval_workflow, security_policies,
          compliance_requirements, departments, business_functions,
          document_categories, workflow_templates,
          supported_languages, company_branding
      ) VALUES 
      (
          'PDH', 'Công ty Cổ phần Phát Đạt', 'Phat Dat Corporation', 'Phát Đạt',
          'Công ty Cổ phần', '0123456789', 'ĐKKD001',
          '123 Nguyễn Huệ, Quận 1, TP.HCM', 'Hồ Chí Minh', 'Hồ Chí Minh',
          '028-12345678', 'info@phatdat.com', 'https://phatdat.com',
          'Bất động sản', 'Parent',
          500000000000, 500000000000, 'VND',
          'Nguyễn Văn A', 'Nguyễn Văn A', 'Trần Thị B',
          'active', '2010-01-15',
          'system', 'Công ty mẹ trong hệ thống Phát Đạt Holdings',
          
          'PDH-{TYPE}-{YEAR}-{SEQUENCE}',
          
          '{"contracts": {"period": 7, "trigger": "expiry", "action": "review"}, "policies": {"period": 5, "trigger": "update", "action": "review"}}',
          
          '{"draft": {"next": "review", "approvers": ["creator", "supervisor"]}, "review": {"next": "approved", "approvers": ["department_head", "legal"]}}',
          
          '{"classification_levels": ["public", "internal", "confidential", "secret"], "default_classification": "internal"}',
          
          ARRAY['Luật Doanh nghiệp', 'Luật Chứng khoán', 'Thông tư 155/2015/TT-BTC'],
          
          '{"BTC": {"name": "Ban Tổng Giám đốc", "code": "BTC", "head": "Tổng Giám đốc"}}',
          
          '{"governance": {"name": "Quản trị doanh nghiệp", "departments": ["BTC", "BPC"]}}',
          
          '{"legal": {"name": "Pháp lý", "subcategories": ["contracts", "agreements", "licenses"]}}',
          
          '{"contract_approval": {"name": "Phê duyệt hợp đồng", "steps": [{"step": "draft", "approver": "legal_officer", "duration": 2}]}}',
          
          ARRAY['vi', 'en'],
          
          '{"logo": "/assets/logos/pdh-logo.png", "colors": {"primary": "#1E40AF"}}'
      )
    `);
    console.log('✅ Đã thêm dữ liệu mẫu cho companies');
    
    // Thêm dữ liệu mẫu cho document_metadata
    try {
      await client.query(`
        INSERT INTO document_metadata (
            dc_identifier, dc_title, dc_description, dc_type, dc_format, dc_language,
            dc_creator, dc_subject, dc_publisher, dc_date, dc_rights,
            record_identifier, record_class, record_status,
            retention_period, retention_trigger, disposal_action,
            security_classification, authorized_users,
            company_id, organization_name, department, business_function,
            workflow_process_name, workflow_process_owner, workflow_approval_required,
            version_major, version_minor, version_patch,
            date_effective, date_expires, date_review,
            document_state,
            keywords, categories, tags,
            created_by, updated_by,
            ocr_confidence, ocr_engine, text_extraction_quality,
            extracted_text, document_summary, key_information,
            entities, key_values, document_sections, common_questions,
            document_context, custom_metadata
        ) VALUES (
            'PDH-CONTRACT-2025-001',
            'Hợp đồng cung cấp dịch vụ hạ tầng CNTT 2025',
            'Hợp đồng ký kết giữa Phát Đạt Holdings và đối tác XYZ',
            'Contract', 'application/pdf', 'vi',
            ARRAY['Ban Pháp chế PDH', 'Phòng CNTT'],
            ARRAY['Hợp đồng dịch vụ', 'CNTT', 'Hạ tầng'],
            'Phát Đạt Holdings',
            '2025-01-20T10:00:00Z',
            'Nội bộ công ty',
            
            'REC-2025-001', 'Contract', 'active',
            7, 'contract_expiry', 'review',
            'internal', ARRAY['Ban Pháp chế', 'Ban Tổng Giám đốc'],
            
            (SELECT id FROM companies WHERE company_code = 'PDH'),
            'Phát Đạt Holdings', 'Ban Pháp chế', 'Quản lý hợp đồng',
            'Quy trình ký kết hợp đồng', 'Trưởng phòng Pháp chế', true,
            
            1, 0, 0,
            '2025-01-20T00:00:00Z', '2025-12-31T23:59:59Z', '2025-06-30T00:00:00Z',
            'published',
            
            ARRAY['hợp đồng', 'CNTT', 'dịch vụ'],
            ARRAY['Hợp đồng', 'Dịch vụ', 'CNTT'],
            ARRAY['urgent', 'annual-contract'],
            
            'system', 'admin',
            95.5, 'Tesseract 5.0', 'excellent',
            
            'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM... HỢP ĐỒNG CUNG CẤP DỊCH VỤ...',
            'Hợp đồng cung cấp dịch vụ hạ tầng CNTT giữa Phát Đạt Holdings và Công ty XYZ',
            
            '{"contract_number": "PDH-CONTRACT-2025-001", "contract_value": 500000000, "currency": "VND"}',
            
            '{"persons": ["Nguyễn Văn A", "Trần Thị B"], "organizations": ["Phát Đạt Holdings", "Công ty XYZ"]}',
            
            '{"contract_value": 500000000, "contract_currency": "VND", "effective_date": "2025-01-20"}',
            
            '[{"section_id": "1", "title": "Thông tin các bên", "content": "Bên A: Phát Đạt Holdings..."}]',
            
            '[{"question": "Hợp đồng này có giá trị bao nhiêu?", "answer": "500,000,000 VND", "confidence": 0.95}]',
            
            '{"background": "Hợp đồng này là phần của dự án nâng cấp hệ thống CNTT"}',
            
            '{"priority": "high", "cost_center": "IT-001"}'
        )
      `);
      console.log('✅ Đã thêm dữ liệu mẫu cho document_metadata');
    } catch (error) {
      console.error('❌ Lỗi khi thêm dữ liệu mẫu cho document_metadata:', error.message);
      console.log('⚠️ Tiếp tục quá trình migration...');
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Đã hoàn thành việc xóa và tạo lại các bảng tài liệu và công ty');
    
  } catch (error) {
    // Rollback transaction nếu có lỗi
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khi xóa và tạo lại các bảng:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Thực thi hàm
recreateDocumentTables()
  .then(() => {
    console.log('🎉 Quá trình xóa và tạo lại các bảng hoàn tất thành công');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Quá trình xóa và tạo lại các bảng thất bại:', error);
    process.exit(1);
  }); 