const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAdmin } = require('../middleware/auth');

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
