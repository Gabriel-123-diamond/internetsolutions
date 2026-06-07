const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { isAdmin } = require('../middleware/auth');

// Password-only login for Admin
router.get('/login', (req, res) => {
  res.render('admin/login', { title: 'Admin Login', error: req.query.error });
});

router.post('/login', (req, res) => {
  const { adminPassword } = req.body;
  if (adminPassword === process.env.ADMIN_PASSWORD) {
    req.session.userId = 'admin-master'; // Special ID for master access
    req.session.role = 'admin';
    return res.redirect('/admin');
  }
  res.redirect('/admin/login?error=Invalid master password');
});

// Protect all other admin routes
router.use(isAdmin);

// Admin Dashboard
router.get('/', async (req, res) => {
  try {
    const stats = {
      totalVouchers: (await db.query('SELECT COUNT(*) FROM vouchers')).rows[0].count,
      activeVouchers: (await db.query("SELECT COUNT(*) FROM vouchers WHERE status = 'active'")).rows[0].count,
      totalRevenue: (await db.query('SELECT SUM(p.price) FROM vouchers v JOIN plans p ON v.plan_id = p.id')).rows[0].sum || 0,
      totalUsers: (await db.query("SELECT COUNT(*) FROM users WHERE role = 'user'")).rows[0].count
    };

    const recentSales = await db.query(`
      SELECT v.*, p.name as plan_name, p.price, u.email as user_email 
      FROM vouchers v 
      JOIN plans p ON v.plan_id = p.id 
      LEFT JOIN users u ON v.user_id = u.id 
      ORDER BY v.created_at DESC LIMIT 10
    `);

    res.render('admin/dashboard', { title: 'Admin Dashboard', stats, recentSales: recentSales.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading admin dashboard');
  }
});

// Admin Settings
router.get('/settings', (req, res) => {
  res.render('admin/settings', { title: 'Admin Settings', error: req.query.error, notice: req.query.notice });
});

router.post('/change-password', async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  if (newPassword !== confirmPassword) {
    return res.redirect('/admin/settings?error=Passwords do not match');
  }
  
  // NOTE: Since the admin password is an ENV variable, changing it via UI 
  // would require updating the ENV on Vercel/Render which is restricted.
  // We advise the user to update it in their dashboard.
  res.redirect('/admin/settings?notice=Please update the ADMIN_PASSWORD environment variable in your Vercel/Render dashboard to permanently change it.');
});

// Plan Management
router.get('/plans', async (req, res) => {
  try {
    const plans = await db.query('SELECT * FROM plans ORDER BY price ASC');
    res.render('admin/plans', { title: 'Manage Plans', plans: plans.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading plans');
  }
});

router.post('/plans/add', async (req, res) => {
  const { name, price, duration_hours, data_gb } = req.body;
  const duration_seconds = parseInt(duration_hours) * 3600;
  const data_bytes = parseInt(data_gb) * 1024 * 1024 * 1024;

  try {
    await db.query(
      'INSERT INTO plans (name, price, duration_seconds, data_bytes) VALUES ($1, $2, $3, $4)',
      [name, price, duration_seconds, data_bytes]
    );
    res.redirect('/admin/plans?notice=Plan added successfully');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/plans?error=Failed to add plan');
  }
});

router.post('/plans/delete/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM plans WHERE id = $1', [req.params.id]);
    res.redirect('/admin/plans?notice=Plan deleted successfully');
  } catch (err) {
    console.error(err);
    res.redirect('/admin/plans?error=Failed to delete plan (it might be linked to existing vouchers)');
  }
});

module.exports = router;
