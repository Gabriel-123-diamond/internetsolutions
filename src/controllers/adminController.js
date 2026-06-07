const adminService = require('../services/adminService');
const voucherService = require('../services/voucherService');

class AdminController {
  renderLogin(req, res) {
    res.render('admin/login', { title: 'Admin Login', error: req.query.error });
  }

  login(req, res) {
    const { adminPassword } = req.body;
    console.log('--- Admin Login Attempt ---');
    if (adminPassword && adminPassword.trim() === (process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : '')) {
      console.log('Password match success');
      req.session.userId = 'admin-master';
      req.session.role = 'admin';
      
      console.log('Saving session for ID:', req.sessionID);
      return req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect('/admin/login?error=Session save failed');
        }
        console.log('Session saved successfully, redirecting to /admin');
        res.redirect('/admin');
      });
    }
    console.log('Password mismatch');
    res.redirect('/admin/login?error=Invalid master password');
  }

  async renderDashboard(req, res) {
    try {
      const stats = await adminService.getDashboardStats();
      const recentSales = await adminService.getRecentSales();
      res.render('admin/dashboard', { title: 'Admin Dashboard', stats, recentSales });
    } catch (err) {
      console.error(err);
      res.status(500).send('Error loading admin dashboard');
    }
  }

  async renderPlans(req, res) {
    try {
      const plans = await voucherService.getAllPlans();
      res.render('admin/plans', { title: 'Manage Plans', plans, error: req.query.error, notice: req.query.notice });
    } catch (err) {
      console.error(err);
      res.status(500).send('Error loading plans');
    }
  }

  async addPlan(req, res) {
    const { name, price, duration_hours, data_gb } = req.body;
    try {
      await adminService.addPlan(name, price, duration_hours, data_gb);
      res.redirect('/admin/plans?notice=Plan added successfully');
    } catch (err) {
      console.error(err);
      res.redirect('/admin/plans?error=Failed to add plan');
    }
  }

  async deletePlan(req, res) {
    try {
      await adminService.deletePlan(req.params.id);
      res.redirect('/admin/plans?notice=Plan deleted successfully');
    } catch (err) {
      console.error(err);
      res.redirect('/admin/plans?error=Failed to delete plan');
    }
  }

  renderSettings(req, res) {
    res.render('admin/settings', { title: 'Admin Settings', error: req.query.error, notice: req.query.notice });
  }
}

module.exports = new AdminController();
