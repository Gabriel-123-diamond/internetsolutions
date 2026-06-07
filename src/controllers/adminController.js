const adminService = require('../services/adminService');
const voucherService = require('../services/voucherService');

class AdminController {
  renderLogin(req, res) {
    res.render('admin/login', { title: 'Admin Login', error: req.query.error });
  }

  login(req, res) {
    const { adminPassword } = req.body;
    if (adminPassword === process.env.ADMIN_PASSWORD) {
      req.session.userId = 'admin-master';
      req.session.role = 'admin';
      return res.redirect('/admin');
    }
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
