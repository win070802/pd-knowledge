const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

class UserRepository {
  async createUser(userData) {
    const client = await pool.connect();
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const result = await client.query(
        'INSERT INTO users (username, password, full_name, phone, birth_date, position, location, role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [userData.username, hashedPassword, userData.fullName, userData.phone, userData.birthDate, userData.position, userData.location, userData.role || 'admin']
      );
      // Remove password from returned data
      const { password, ...userWithoutPassword } = result.rows[0];
      return userWithoutPassword;
    } finally {
      client.release();
    }
  }

  async getUserByUsername(username) {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM users WHERE username = $1 AND is_active = TRUE', [username]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getUserById(id) {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM users WHERE id = $1 AND is_active = TRUE', [id]);
      if (result.rows.length > 0) {
        const { password, ...userWithoutPassword } = result.rows[0];
        return userWithoutPassword;
      }
      return null;
    } finally {
      client.release();
    }
  }

  async getUsers() {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT id, username, full_name, phone, birth_date, position, location, role, is_active, created_at FROM users ORDER BY created_at DESC');
      return result.rows;
    } finally {
      client.release();
    }
  }

  async validatePassword(username, password) {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM users WHERE username = $1 AND is_active = TRUE', [username]);
      if (result.rows.length === 0) {
        return null;
      }
      
      const user = result.rows[0];
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (isValidPassword) {
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
      return null;
    } finally {
      client.release();
    }
  }

  async updateUser(id, userData) {
    const client = await pool.connect();
    try {
      const updateFields = [];
      const values = [];
      let paramIndex = 1;

      if (userData.fullName) {
        updateFields.push(`full_name = $${paramIndex++}`);
        values.push(userData.fullName);
      }
      if (userData.phone) {
        updateFields.push(`phone = $${paramIndex++}`);
        values.push(userData.phone);
      }
      if (userData.position) {
        updateFields.push(`position = $${paramIndex++}`);
        values.push(userData.position);
      }
      if (userData.location) {
        updateFields.push(`location = $${paramIndex++}`);
        values.push(userData.location);
      }
      if (userData.password) {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        updateFields.push(`password = $${paramIndex++}`);
        values.push(hashedPassword);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
      const result = await client.query(query, values);
      
      if (result.rows.length > 0) {
        const { password, ...userWithoutPassword } = result.rows[0];
        return userWithoutPassword;
      }
      return null;
    } finally {
      client.release();
    }
  }

  async deactivateUser(id) {
    const client = await pool.connect();
    try {
      const result = await client.query('UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id', [id]);
      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }
}

module.exports = new UserRepository(); 