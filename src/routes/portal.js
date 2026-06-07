const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Root redirect
router.get('/', (req, res) => {
  res.redirect('/portal');
});

// Captive Portal landing page
router.get('/portal', async (req, res) => {
  const { mac, ip, gw_address, gw_port } = req.query;
  
  // Save CoovaChilli parameters to session
  if (mac) req.session.mac = mac;
  if (ip) req.session.ip = ip;
  if (gw_address) req.session.gw_address = gw_address;
  if (gw_port) req.session.gw_port = gw_port;
  
  try {
    const plansResult = await db.query('SELECT * FROM plans ORDER BY price ASC');
    res.render('portal', { 
      title: 'Welcome to Our Captive Portal',
      error: req.query.error,
      notice: req.query.notice,
      mac: mac || req.session.mac,
      plans: plansResult.rows
    });
  } catch (err) {
    console.error(err);
    res.render('portal', { 
      title: 'Welcome to Our Captive Portal',
      error: 'Failed to load plans',
      notice: req.query.notice,
      mac: mac || req.session.mac,
      plans: []
    });
  }
});

// Voucher Login (Captive Portal Login)
router.post('/login/voucher', async (req, res) => {
  const { voucherCode } = req.body;
  const mac = req.session.mac;

  if (!voucherCode || voucherCode.length !== 6) {
    return res.redirect('/portal?error=Invalid voucher code');
  }

  try {
    const result = await db.query(
      'SELECT v.*, p.duration_seconds, p.data_bytes FROM vouchers v JOIN plans p ON v.plan_id = p.id WHERE v.username = $1',
      [voucherCode]
    );

    if (result.rows.length === 0) {
      return res.redirect('/portal?error=Voucher not found');
    }

    const voucher = result.rows[0];

    if (voucher.status === 'expired') {
      return res.redirect('/portal?error=Voucher has expired');
    }

    const timeRemaining = voucher.total_duration_allowed - voucher.accumulated_time_used;
    const dataRemaining = voucher.total_data_allowed - voucher.accumulated_data_used;

    if ((voucher.total_duration_allowed > 0 && timeRemaining <= 0) || 
        (voucher.total_data_allowed > 0 && dataRemaining <= 0)) {
      await db.query("UPDATE vouchers SET status = 'expired' WHERE id = $1", [voucher.id]);
      return res.redirect('/portal?error=Voucher has hit limits');
    }

    await db.query(
      "UPDATE vouchers SET status = 'active', last_mac_address = $1 WHERE id = $2",
      [mac, voucher.id]
    );

    const { gw_address, gw_port } = req.session;
    if (gw_address && gw_port) {
      const redirectUrl = `http://${gw_address}:${gw_port}/www/login.chi?username=${voucher.username}&password=${voucher.password}`;
      return res.redirect(redirectUrl);
    } else {
      return res.render('success', { 
        title: 'Success', 
        message: 'Successfully authenticated. You can now browse the internet.',
        voucher: voucher
      });
    }
  } catch (err) {
    console.error(err);
    res.redirect('/portal?error=Internal server error');
  }
});

// User Account Login
router.get('/login', (req, res) => {
  res.render('login', { title: 'User Login', error: req.query.error });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.redirect('/login?error=Invalid email or password');
    }
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.redirect('/login?error=Invalid email or password');
    }
    req.session.userId = user.id;
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.redirect('/login?error=Internal server error');
  }
});

// User Registration
router.get('/register', (req, res) => {
  res.render('register', { title: 'Register', error: req.query.error });
});

router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.redirect('/register?error=Please fill all fields');
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (email, password) VALUES ($1, $2)',
      [email, hashedPassword]
    );
    res.redirect('/login?notice=Registration successful! Please login.');
  } catch (err) {
    if (err.code === '23505') {
      return res.redirect('/register?error=Email already registered');
    }
    console.error(err);
    res.redirect('/register?error=Internal server error');
  }
});

// Dashboard
router.get('/dashboard', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  try {
    const result = await db.query(
      'SELECT v.*, p.name as plan_name FROM vouchers v JOIN plans p ON v.plan_id = p.id WHERE v.user_id = $1 ORDER BY v.created_at DESC',
      [req.session.userId]
    );
    res.render('dashboard', { title: 'User Dashboard', vouchers: result.rows });
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', error: 'Failed to load dashboard' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/portal');
});

module.exports = router;
