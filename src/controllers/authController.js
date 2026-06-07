const authService = require('../services/authService');

class AuthController {
  async register(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.redirect('/register?error=Please fill all fields');
    }
    try {
      await authService.register(email, password);
      res.redirect('/login?notice=Registration successful! Please login.');
    } catch (err) {
      if (err.code === '23505') {
        return res.redirect('/register?error=Email already registered');
      }
      console.error(err);
      res.redirect('/register?error=Internal server error');
    }
  }

  async login(req, res) {
    const { email, password } = req.body;
    console.log('--- Main Login Attempt ---');
    console.log('Email:', email);
    try {
      const user = await authService.login(email, password);
      
      const adminPass = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : '';
      const isMasterAdmin = (email === 'admin' && password && password.trim() === adminPass);

      if (!user && !isMasterAdmin) {
        console.log('Login failed: Invalid credentials');
        return res.redirect('/login?error=Invalid email or password');
      }
      
      req.session.userId = user ? user.id : 'admin-master';
      req.session.role = user ? user.role : 'admin';
      
      console.log('Login success. UserID:', req.session.userId, 'Role:', req.session.role);
      console.log('Saving session for ID:', req.sessionID);

      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect('/login?error=Session save failed');
        }
        console.log('Session saved. Redirecting...');
        res.redirect(req.session.role === 'admin' ? '/admin' : '/dashboard');
      });
    } catch (err) {
      console.error('Login Error:', err);
      res.redirect('/login?error=Internal server error');
    }
  }

  async changePassword(req, res) {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (newPassword !== confirmPassword) {
      return res.redirect('/settings?error=New passwords do not match');
    }
    try {
      const success = await authService.changePassword(req.session.userId, currentPassword, newPassword);
      if (!success) {
        return res.redirect('/settings?error=Current password is incorrect');
      }
      res.redirect('/settings?notice=Password updated successfully');
    } catch (err) {
      console.error(err);
      res.redirect('/settings?error=Internal server error');
    }
  }

  logout(req, res) {
    req.session.destroy();
    res.redirect('/portal');
  }
}

module.exports = new AuthController();
