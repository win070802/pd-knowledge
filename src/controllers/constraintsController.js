const geminiService = require('../../gemini');

// Get all constraints
const getConstraints = async (req, res) => {
  try {
    const constraints = geminiService.getConstraints();
    res.json({ success: true, data: constraints });
  } catch (error) {
    console.error('Error getting constraints:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add or update constraint
const addConstraint = async (req, res) => {
  try {
    const { question, answer } = req.body;
    
    if (!question || !answer) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question and answer are required' 
      });
    }

    const success = geminiService.addConstraint(question, answer);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Constraint added successfully',
        data: { question, answer }
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to add constraint' 
      });
    }
  } catch (error) {
    console.error('Error adding constraint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete constraint
const deleteConstraint = async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question is required' 
      });
    }

    const success = geminiService.removeConstraint(question);
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Constraint removed successfully',
        data: { question }
      });
    } else {
      res.status(404).json({ 
        success: false, 
        error: 'Constraint not found' 
      });
    }
  } catch (error) {
    console.error('Error removing constraint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getConstraints,
  addConstraint,
  deleteConstraint
}; 