const fs = require('fs');
const path = require('path');

class ConstraintsService {
  constructor() {
    this.constraints = this.loadConstraints();
  }

  // Load constraints from JSON file
  loadConstraints() {
    try {
      const constraintsPath = path.join(__dirname, '../../../constraints.json');
      if (fs.existsSync(constraintsPath)) {
        const data = fs.readFileSync(constraintsPath, 'utf8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      console.error('Error loading constraints:', error);
      return {};
    }
  }

  // Check if question matches any constraint
  checkConstraints(question) {
    if (!this.constraints || !this.constraints.commonQuestions) {
      return null;
    }

    const questionLower = question.toLowerCase().trim();
    
    // Direct match with common questions
    for (const [constraintQuestion, answer] of Object.entries(this.constraints.commonQuestions)) {
      if (questionLower === constraintQuestion.toLowerCase()) {
        return answer;
      }
    }

    // Fuzzy match for similar questions
    const questionWords = questionLower.split(/\s+/);
    
    for (const [constraintQuestion, answer] of Object.entries(this.constraints.commonQuestions)) {
      const constraintWords = constraintQuestion.toLowerCase().split(/\s+/);
      
      // Check if most important words match
      let matchCount = 0;
      for (const word of questionWords) {
        if (word.length > 2 && constraintWords.includes(word)) {
          matchCount++;
        }
      }
      
      // If enough words match, consider it a match
      if (matchCount >= Math.min(2, questionWords.length - 1)) {
        return answer;
      }
    }

    // Check for company keywords
    if (this.constraints.companies) {
      for (const [companyCode, companyInfo] of Object.entries(this.constraints.companies)) {
        if (companyInfo.keywords) {
          for (const keyword of companyInfo.keywords) {
            if (questionLower.includes(keyword.toLowerCase())) {
              // If question is about the company, return company description
              if (questionLower.includes('là gì') || questionLower.includes('là công ty gì') || 
                  questionLower.includes('what') || questionLower.includes('company')) {
                return companyInfo.description;
              }
            }
          }
        }
      }
    }

    return null;
  }

  // Add or update constraint
  addConstraint(question, answer) {
    try {
      if (!this.constraints.commonQuestions) {
        this.constraints.commonQuestions = {};
      }
      
      this.constraints.commonQuestions[question] = answer;
      
      // Save to file
      const constraintsPath = path.join(__dirname, '../../../constraints.json');
      fs.writeFileSync(constraintsPath, JSON.stringify(this.constraints, null, 2), 'utf8');
      
      console.log(`✅ Added constraint: "${question}" -> "${answer}"`);
      return true;
    } catch (error) {
      console.error('Error adding constraint:', error);
      return false;
    }
  }

  // Remove constraint
  removeConstraint(question) {
    try {
      if (!this.constraints.commonQuestions) {
        return false;
      }
      
      if (this.constraints.commonQuestions[question]) {
        delete this.constraints.commonQuestions[question];
        
        // Save to file
        const constraintsPath = path.join(__dirname, '../../../constraints.json');
        fs.writeFileSync(constraintsPath, JSON.stringify(this.constraints, null, 2), 'utf8');
        
        console.log(`✅ Removed constraint: "${question}"`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error removing constraint:', error);
      return false;
    }
  }

  // Get all constraints
  getConstraints() {
    return this.constraints;
  }
}

module.exports = ConstraintsService; 