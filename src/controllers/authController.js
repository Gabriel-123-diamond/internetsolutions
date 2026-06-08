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
    
    try {
      // 1. Check for standard user login
      const user = await authService.login(email, password);
      
      // 2. Check for master admin fallback
      let admin = null;
      if (email === 'admin') {
        admin = authService.validateMasterAdmin(password);
      }

      if (!user && !admin) {
        console.log('Login failed: Invalid credentials');
        return res.redirect('/login?error=Invalid email or password');
      }
      
      req.session.userId = user ? user.id : admin.userId;
      req.session.role = user ? user.role : admin.role;
      
      console.log('Login success. UserID:', req.session.userId, 'Role:', req.session.role);

      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect('/login?error=Session save failed');
        }
        res.redirect(req.session.role === 'admin' ? '/admin' : '/dashboard');
      });
    } catch (err) {
      console.error('Login Error:', err);
      res.redirect('/login?error=Internal server error');
    }
  }

  async changePassword(req, res) {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const redirectPath = req.session.role === 'admin' ? '/admin/settings' : '/settings';

    if (newPassword !== confirmPassword) {
      return res.redirect(`${redirectPath}?error=New passwords do not match`);
    }

    // Special handling for master admin (not in DB)
    if (req.session.userId === 'admin-master') {
      return res.redirect(`${redirectPath}?error=Master password can only be changed in the system configuration (.env)`);
    }

    try {
      const success = await authService.changePassword(req.session.userId, currentPassword, newPassword);
      if (!success) {
        return res.redirect(`${redirectPath}?error=Current password is incorrect`);
      }
      res.redirect(`${redirectPath}?notice=Password updated successfully`);
    } catch (err) {
      console.error(err);
      res.redirect(`${redirectPath}?error=Internal server error`);
    }
  }

  logout(req, res) {
    req.session.destroy();
    res.redirect('/portal');
  }
}

module.exports = new AuthController();
