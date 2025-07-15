const { initializeDatabase } = require('./src/models/schema');
const documentRepository = require('./src/repositories/documentRepository');
const companyRepository = require('./src/repositories/companyRepository');
const questionRepository = require('./src/repositories/questionRepository');
const sensitiveRuleRepository = require('./src/repositories/sensitiveRuleRepository');
const knowledgeRepository = require('./src/repositories/knowledgeRepository');
const userRepository = require('./src/repositories/userRepository');

// Main database interface that delegates to appropriate repositories
const db = {
  // Document operations
  createDocument: documentRepository.createDocument.bind(documentRepository),
  getDocuments: documentRepository.getDocuments.bind(documentRepository),
  getDocumentById: documentRepository.getDocumentById.bind(documentRepository),
  getDocumentsByCompany: documentRepository.getDocumentsByCompany.bind(documentRepository),
  updateDocumentProcessed: documentRepository.updateDocumentProcessed.bind(documentRepository),
  updateDocument: documentRepository.updateDocument.bind(documentRepository),
  searchDocuments: documentRepository.searchDocuments.bind(documentRepository),
  deleteDocument: documentRepository.deleteDocument.bind(documentRepository),
  
  // Document chunks
  createDocumentChunk: documentRepository.createDocumentChunk.bind(documentRepository),
  getDocumentChunks: documentRepository.getDocumentChunks.bind(documentRepository),

  // Company operations
  createCompany: companyRepository.createCompany.bind(companyRepository),
  getCompanies: companyRepository.getCompanies.bind(companyRepository),
  getCompanyByCode: companyRepository.getCompanyByCode.bind(companyRepository),
  updateCompany: companyRepository.updateCompany.bind(companyRepository),
  deleteCompany: companyRepository.deleteCompany.bind(companyRepository),

  // Question operations
  createQuestion: questionRepository.createQuestion.bind(questionRepository),
  getQuestions: questionRepository.getQuestions.bind(questionRepository),

  // Sensitive rules operations
  createSensitiveRule: sensitiveRuleRepository.createSensitiveRule.bind(sensitiveRuleRepository),
  getSensitiveRules: sensitiveRuleRepository.getSensitiveRules.bind(sensitiveRuleRepository),
  updateSensitiveRule: sensitiveRuleRepository.updateSensitiveRule.bind(sensitiveRuleRepository),
  deleteSensitiveRule: sensitiveRuleRepository.deleteSensitiveRule.bind(sensitiveRuleRepository),

  // Knowledge base operations
  createKnowledge: knowledgeRepository.createKnowledge.bind(knowledgeRepository),
  getKnowledgeByCompany: knowledgeRepository.getKnowledgeByCompany.bind(knowledgeRepository),
  searchKnowledge: knowledgeRepository.searchKnowledge.bind(knowledgeRepository),
  updateKnowledge: knowledgeRepository.updateKnowledge.bind(knowledgeRepository),
  deleteKnowledge: knowledgeRepository.deleteKnowledge.bind(knowledgeRepository),

  // User operations
  createUser: userRepository.createUser.bind(userRepository),
  getUserByUsername: userRepository.getUserByUsername.bind(userRepository),
  getUserById: userRepository.getUserById.bind(userRepository),
  getUsers: userRepository.getUsers.bind(userRepository),
  validatePassword: userRepository.validatePassword.bind(userRepository),
  updateUser: userRepository.updateUser.bind(userRepository),
  deactivateUser: userRepository.deactivateUser.bind(userRepository)
};

module.exports = { initializeDatabase, db }; 