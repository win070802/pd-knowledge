#!/bin/bash

# PDF Knowledge Management System - API Examples
# Comprehensive examples for all available endpoints

BASE_URL="http://localhost:8080"

echo "🚀 PDF Knowledge Management System - API Examples"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_section() {
    echo -e "\n${BLUE}📋 $1${NC}"
    echo "----------------------------------------"
}

print_endpoint() {
    echo -e "${CYAN}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Function to check if server is running
check_server() {
    if curl -s "$BASE_URL/health" > /dev/null; then
        print_success "Server is running at $BASE_URL"
    else
        print_error "Server is not running at $BASE_URL"
        echo "Please start the server with: npm start"
        exit 1
    fi
}

# ============================================================================
# SYSTEM APIs
# ============================================================================

demo_system_apis() {
    print_section "SYSTEM APIs"
    
    print_endpoint "1. Health Check"
    curl -s "$BASE_URL/health" | jq '.'
    echo
}

# ============================================================================
# DOCUMENT MANAGEMENT APIs
# ============================================================================

demo_document_apis() {
    print_section "DOCUMENT MANAGEMENT APIs"
    
    print_endpoint "2. Get All Documents"
    curl -s "$BASE_URL/api/documents" | jq '.documents | length'
    print_info "Total documents in system"
    echo
    
    print_endpoint "3. Get Document by ID (example: document 25)"
    curl -s "$BASE_URL/api/documents/25" | jq '.document.original_name'
    echo
    
    print_endpoint "4. Search Documents"
    curl -s "$BASE_URL/api/search?q=ban%20tài%20chính" | jq '.documents | length'
    print_info "Documents found for 'ban tài chính'"
    echo
    
    print_endpoint "5. 🆕 AI Text Correction - Reprocess Document"
    print_info "This will improve OCR quality using AI"
    curl -X POST "$BASE_URL/api/documents/25/reprocess" | jq '.'
    echo
    
    print_endpoint "6. Upload PDF Document"
    print_info "Example (requires PDF file):"
    echo "curl -X POST $BASE_URL/api/upload -F 'document=@document.pdf'"
    echo
}

# ============================================================================
# Q&A AND AI APIs
# ============================================================================

demo_qa_apis() {
    print_section "Q&A AND AI APIs"
    
    print_endpoint "7. Ask Question (Constraint Example)"
    curl -X POST "$BASE_URL/api/ask" \
      -H 'Content-Type: application/json' \
      -d '{"question": "PDH là công ty gì?"}' | jq '.answer'
    echo
    
    print_endpoint "8. Ask Question (Document-specific)"
    curl -X POST "$BASE_URL/api/ask" \
      -H 'Content-Type: application/json' \
      -d '{"question": "Sơ đồ chức năng ban tài chính có những gì?"}' | jq '.answer'
    echo
    
    print_endpoint "9. Ask Question (General)"
    curl -X POST "$BASE_URL/api/ask" \
      -H 'Content-Type: application/json' \
      -d '{"question": "Xin chào"}' | jq '.answer'
    echo
    
    print_endpoint "10. Get Q&A History (last 5)"
    curl -s "$BASE_URL/api/history?limit=5" | jq '.questions | length'
    print_info "Recent questions count"
    echo
    
    print_endpoint "11. Summarize Document"
    print_info "Example (requires document ID):"
    echo "curl -X POST $BASE_URL/api/summarize/25"
    echo
    
    print_endpoint "12. Extract Key Information"
    curl -X POST "$BASE_URL/api/extract" \
      -H 'Content-Type: application/json' \
      -d '{"searchTerm": "ban tài chính"}' | jq '.result.info'
    echo
}

# ============================================================================
# CONSTRAINT MANAGEMENT APIs
# ============================================================================

demo_constraint_apis() {
    print_section "🆕 CONSTRAINT MANAGEMENT APIs"
    
    print_endpoint "13. Get All Constraints"
    curl -s "$BASE_URL/api/constraints" | jq '.data.commonQuestions | keys'
    echo
    
    print_endpoint "14. Add Constraint"
    curl -X POST "$BASE_URL/api/constraints" \
      -H 'Content-Type: application/json' \
      -d '{"question": "Test constraint", "answer": "This is a test answer"}' | jq '.success'
    echo
    
    print_endpoint "15. Test New Constraint"
    curl -X POST "$BASE_URL/api/ask" \
      -H 'Content-Type: application/json' \
      -d '{"question": "Test constraint"}' | jq '.answer'
    echo
    
    print_endpoint "16. Remove Constraint"
    curl -X DELETE "$BASE_URL/api/constraints" \
      -H 'Content-Type: application/json' \
      -d '{"question": "Test constraint"}' | jq '.success'
    echo
}

# ============================================================================
# COMPANY MANAGEMENT APIs
# ============================================================================

demo_company_apis() {
    print_section "🆕 COMPANY MANAGEMENT APIs"
    
    print_endpoint "17. Get All Companies"
    curl -s "$BASE_URL/api/companies" | jq '.data | length'
    print_info "Total companies in system"
    echo
    
    print_endpoint "18. Get Company by Code (PDH)"
    curl -s "$BASE_URL/api/companies/PDH" | jq '.data.full_name'
    echo
    
    print_endpoint "19. Create Test Company"
    curl -X POST "$BASE_URL/api/companies" \
      -H 'Content-Type: application/json' \
      -d '{
        "code": "TEST",
        "fullName": "Test Company Ltd",
        "description": "A test company for API demo",
        "keywords": ["TEST", "Demo"]
      }' | jq '.success'
    echo
    
    print_endpoint "20. Update Test Company"
    curl -X PUT "$BASE_URL/api/companies/TEST" \
      -H 'Content-Type: application/json' \
      -d '{
        "fullName": "Test Company Updated",
        "ceo": "John Doe"
      }' | jq '.success'
    echo
    
    print_endpoint "21. Delete Test Company"
    curl -X DELETE "$BASE_URL/api/companies/TEST" | jq '.success'
    echo
}

# ============================================================================
# SENSITIVE RULES MANAGEMENT APIs
# ============================================================================

demo_sensitive_rules_apis() {
    print_section "🆕 SENSITIVE RULES MANAGEMENT APIs"
    
    print_endpoint "22. Get Sensitive Rules"
    curl -s "$BASE_URL/api/sensitive-rules" | jq '.data | length'
    print_info "Total sensitive rules"
    echo
    
    print_endpoint "23. Create Test Sensitive Rule"
    curl -X POST "$BASE_URL/api/sensitive-rules" \
      -H 'Content-Type: application/json' \
      -d '{
        "ruleName": "Test Rule",
        "pattern": "test_sensitive|demo_block",
        "description": "Test rule for API demo",
        "isActive": true
      }' | jq '.success'
    echo
    
    print_endpoint "24. Test Sensitive Content Detection"
    curl -X POST "$BASE_URL/api/ask" \
      -H 'Content-Type: application/json' \
      -d '{"question": "test_sensitive content"}' | jq '.answer'
    echo
}

# ============================================================================
# KNOWLEDGE BASE MANAGEMENT APIs
# ============================================================================

demo_knowledge_apis() {
    print_section "🆕 KNOWLEDGE BASE MANAGEMENT APIs"
    
    print_endpoint "25. Search Knowledge Base"
    curl -s "$BASE_URL/api/knowledge/search?q=PDH" | jq '.data | length'
    print_info "Knowledge entries found for 'PDH'"
    echo
    
    print_endpoint "26. Create Knowledge Entry"
    curl -X POST "$BASE_URL/api/knowledge" \
      -H 'Content-Type: application/json' \
      -d '{
        "companyId": 1,
        "question": "Test knowledge question",
        "answer": "This is a test knowledge answer",
        "keywords": ["test", "demo"],
        "category": "Test",
        "isActive": true
      }' | jq '.success'
    echo
    
    print_endpoint "27. Get Knowledge by Company"
    curl -s "$BASE_URL/api/knowledge/company/1?active=true" | jq '.data | length'
    print_info "Knowledge entries for company ID 1"
    echo
}

# ============================================================================
# DEBUG AND ANALYSIS APIs
# ============================================================================

demo_debug_apis() {
    print_section "🆕 DEBUG AND ANALYSIS APIs"
    
    print_endpoint "28. Debug Search Algorithm"
    curl -X POST "$BASE_URL/api/debug/search" \
      -H 'Content-Type: application/json' \
      -d '{"question": "ban tài chính"}' | jq '{
        keywords: .keywords,
        totalResults: (.results | length),
        duplicatesSkipped: .duplicatesSkipped
      }'
    echo
    
    print_endpoint "29. Analyze Specific Document"
    curl -s "$BASE_URL/api/debug/docs/25" | jq '.analysis | {
        contentLength,
        wordCount,
        processingMethod,
        ocrConfidence
      }'
    echo
}

# ============================================================================
# PERFORMANCE TESTING
# ============================================================================

demo_performance() {
    print_section "⚡ PERFORMANCE TESTING"
    
    print_endpoint "30. Constraint Response Time"
    time curl -X POST "$BASE_URL/api/ask" \
      -H 'Content-Type: application/json' \
      -d '{"question": "PDH là công ty gì?"}' > /dev/null 2>&1
    echo
    
    print_endpoint "31. Document Search Response Time"
    time curl -X POST "$BASE_URL/api/ask" \
      -H 'Content-Type: application/json' \
      -d '{"question": "Sơ đồ chức năng ban tài chính"}' > /dev/null 2>&1
    echo
}

# ============================================================================
# WORKFLOW EXAMPLES
# ============================================================================

demo_workflows() {
    print_section "🔧 WORKFLOW EXAMPLES"
    
    print_endpoint "32. Complete Document Workflow"
    print_info "Step 1: Upload document (manual step)"
    echo "curl -X POST $BASE_URL/api/upload -F 'document=@orgchart.pdf'"
    
    print_info "Step 2: AI text correction"
    echo "curl -X POST $BASE_URL/api/documents/25/reprocess"
    
    print_info "Step 3: Ask questions"
    echo "curl -X POST $BASE_URL/api/ask -d '{\"question\": \"Ai là trưởng ban tài chính?\"}'"
    
    print_info "Step 4: Debug if needed"
    echo "curl -X POST $BASE_URL/api/debug/search -d '{\"question\": \"ban tài chính\"}'"
    echo
    
    print_endpoint "33. Constraint Management Workflow"
    print_info "Step 1: Add constraint"
    curl -X POST "$BASE_URL/api/constraints" \
      -H 'Content-Type: application/json' \
      -d '{"question": "Demo workflow", "answer": "This is a demo workflow answer"}' > /dev/null
    
    print_info "Step 2: Test constraint (should be instant)"
    curl -X POST "$BASE_URL/api/ask" \
      -H 'Content-Type: application/json' \
      -d '{"question": "Demo workflow"}' | jq '.responseTime'
    
    print_info "Step 3: Clean up"
    curl -X DELETE "$BASE_URL/api/constraints" \
      -H 'Content-Type: application/json' \
      -d '{"question": "Demo workflow"}' > /dev/null
    echo
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

main() {
    echo -e "${PURPLE}🎯 Starting comprehensive API demonstration...${NC}"
    
    # Check if server is running
    check_server
    
    # Run all demos based on arguments
    if [[ $# -eq 0 ]]; then
        # Run all demos
        demo_system_apis
        demo_document_apis
        demo_qa_apis
        demo_constraint_apis
        demo_company_apis
        demo_sensitive_rules_apis
        demo_knowledge_apis
        demo_debug_apis
        demo_performance
        demo_workflows
    else
        # Run specific demos
        for arg in "$@"; do
            case $arg in
                "system") demo_system_apis ;;
                "docs") demo_document_apis ;;
                "qa") demo_qa_apis ;;
                "constraints") demo_constraint_apis ;;
                "companies") demo_company_apis ;;
                "sensitive") demo_sensitive_rules_apis ;;
                "knowledge") demo_knowledge_apis ;;
                "debug") demo_debug_apis ;;
                "performance") demo_performance ;;
                "workflows") demo_workflows ;;
                *) echo "Unknown option: $arg" ;;
            esac
        done
    fi
    
    echo -e "\n${GREEN}🎉 API demonstration completed!${NC}"
    echo -e "${YELLOW}📖 Check API_GUIDE.md for detailed documentation${NC}"
    echo -e "${YELLOW}📋 Check API_QUICK_REFERENCE.md for quick lookup${NC}"
}

# Help function
show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  system       - System APIs (health check)"
    echo "  docs         - Document management APIs"
    echo "  qa           - Q&A and AI APIs"
    echo "  constraints  - Constraint management APIs"
    echo "  companies    - Company management APIs"
    echo "  sensitive    - Sensitive rules APIs"
    echo "  knowledge    - Knowledge base APIs"
    echo "  debug        - Debug and analysis APIs"
    echo "  performance  - Performance testing"
    echo "  workflows    - Workflow examples"
    echo ""
    echo "Examples:"
    echo "  $0                    # Run all demos"
    echo "  $0 qa debug          # Run only Q&A and debug demos"
    echo "  $0 constraints       # Run only constraint demos"
    echo ""
    echo "🚀 Make sure the server is running at $BASE_URL"
}

# Check for help flag
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    print_error "jq is required for JSON formatting. Install with: brew install jq"
    exit 1
fi

# Run main function
main "$@" 