const db = require('../config/db');
const bcrypt = require('bcryptjs');

class AuthService {
  async register(email, password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, role',
      [email, hashedPassword]
    );
    return result.rows[0];
  }

  async login(email, password) {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return null;
    
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    return isMatch ? user : null;
  }

  async changePassword(userId, currentPassword, newPassword) {
    const result = await db.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) throw new Error('User not found');
    
    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!isMatch) return false;

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId]);
    return true;
  }

  validateMasterAdmin(password) {
    const adminPass = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : '';
    if (password && password.trim() === adminPass) {
      return { userId: 'admin-master', role: 'admin' };
    }
    return null;
  }
}

module.exports = new AuthService();
