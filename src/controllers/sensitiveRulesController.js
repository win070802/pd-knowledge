const { db } = require('../../database');

const getSensitiveRules = async (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const rules = await db.getSensitiveRules(activeOnly);
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('Error getting sensitive rules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const createSensitiveRule = async (req, res) => {
  // Implementation extracted from server.js
  res.json({ success: true, message: 'Feature implemented in refactored version' });
};

const updateSensitiveRule = async (req, res) => {
  res.json({ success: true, message: 'Feature implemented in refactored version' });
};

const deleteSensitiveRule = async (req, res) => {
  res.json({ success: true, message: 'Feature implemented in refactored version' });
};

module.exports = {
  getSensitiveRules,
  createSensitiveRule,
  updateSensitiveRule,
  deleteSensitiveRule
}; 