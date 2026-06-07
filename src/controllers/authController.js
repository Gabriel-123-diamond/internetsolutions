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
    try {
      const user = await authService.login(email, password);
      const isMasterAdmin = (email === 'admin' && password === process.env.ADMIN_PASSWORD); // Fallback if no user entry

      if (!user && !isMasterAdmin) {
        return res.redirect('/login?error=Invalid email or password');
      }
      
      req.session.userId = user ? user.id : 'admin-master';
      req.session.role = user ? user.role : 'admin';
      res.redirect(req.session.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      console.error(err);
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
