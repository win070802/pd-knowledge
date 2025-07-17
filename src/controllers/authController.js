const userRepository = require('../repositories/userRepository');
const { generateToken } = require('../middleware/auth');

class AuthController {
  // User login
  async login(req, res) {
    try {
      const { username, password } = req.body;
      console.log('Login attempt:', { username });

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required'
        });
      }

      // Validate user credentials
      console.log('Validating user credentials...');
      const user = await userRepository.validatePassword(username, password);
      console.log('User found:', user ? 'yes' : 'no');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password'
        });
      }

      // Generate JWT token
      const token = generateToken(user);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            role: user.role,
            phone: user.phone,
            position: user.position,
            location: user.location
          },
          token,
          expiresIn: '24h'
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }

  // Get current user profile
  async getProfile(req, res) {
    try {
      const user = req.user; // Set by auth middleware

      res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role,
          phone: user.phone,
          birthDate: user.birth_date,
          position: user.position,
          location: user.location,
          createdAt: user.created_at
        }
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user profile',
        error: error.message
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const { fullName, phone, position, location, currentPassword, newPassword } = req.body;

      // If changing password, verify current password
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            message: 'Current password is required to change password'
          });
        }

        const isValidPassword = await userRepository.validatePassword(req.user.username, currentPassword);
        if (!isValidPassword) {
          return res.status(400).json({
            success: false,
            message: 'Current password is incorrect'
          });
        }
      }

      const updateData = {
        fullName,
        phone,
        position,
        location
      };

      if (newPassword) {
        updateData.password = newPassword;
      }

      const updatedUser = await userRepository.updateUser(userId, updateData);

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          id: updatedUser.id,
          username: updatedUser.username,
          fullName: updatedUser.full_name,
          role: updatedUser.role,
          phone: updatedUser.phone,
          position: updatedUser.position,
          location: updatedUser.location
        }
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: error.message
      });
    }
  }

  // Create new user (admin only)
  async createUser(req, res) {
    try {
      const { username, password, fullName, phone, birthDate, position, location, role } = req.body;

      if (!username || !password || !fullName) {
        return res.status(400).json({
          success: false,
          message: 'Username, password, and full name are required'
        });
      }

      // Check if username already exists
      const existingUser = await userRepository.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }

      const userData = {
        username,
        password,
        fullName,
        phone,
        birthDate,
        position,
        location,
        role: role || 'admin'
      };

      const newUser = await userRepository.createUser(userData);

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: newUser
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create user',
        error: error.message
      });
    }
  }

  // Get all users (admin only)
  async getUsers(req, res) {
    try {
      const users = await userRepository.getUsers();

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get users',
        error: error.message
      });
    }
  }

  // Deactivate user (admin only)
  async deactivateUser(req, res) {
    try {
      const { id } = req.params;

      if (parseInt(id) === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate your own account'
        });
      }

      const success = await userRepository.deactivateUser(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User deactivated successfully'
      });
    } catch (error) {
      console.error('Deactivate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate user',
        error: error.message
      });
    }
  }

  // Verify token (check if user is still logged in)
  async verifyToken(req, res) {
    try {
      // req.user is set by auth middleware
      res.json({
        success: true,
        message: 'Token is valid',
        data: {
          id: req.user.id,
          username: req.user.username,
          role: req.user.role
        }
      });
    } catch (error) {
      console.error('Verify token error:', error);
      res.status(500).json({
        success: false,
        message: 'Token verification failed',
        error: error.message
      });
    }
  }
}

module.exports = new AuthController(); 