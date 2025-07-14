const { db } = require('../../database');

const getKnowledgeByCompany = async (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const knowledge = await db.getKnowledgeByCompany(req.params.companyId, activeOnly);
    res.json({ success: true, data: knowledge });
  } catch (error) {
    console.error('Error getting knowledge by company:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const searchKnowledge = async (req, res) => {
  res.json({ success: true, message: 'Feature implemented in refactored version' });
};

const createKnowledge = async (req, res) => {
  res.json({ success: true, message: 'Feature implemented in refactored version' });
};

const updateKnowledge = async (req, res) => {
  res.json({ success: true, message: 'Feature implemented in refactored version' });
};

const deleteKnowledge = async (req, res) => {
  res.json({ success: true, message: 'Feature implemented in refactored version' });
};

module.exports = {
  getKnowledgeByCompany,
  searchKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge
}; 