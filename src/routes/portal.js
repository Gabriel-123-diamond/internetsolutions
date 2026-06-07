const express = require('express');
const router = express.Router();
const db = require('../config/db');
const crypto = require('crypto');

// Root redirect
router.get('/', (req, res) => {
  res.redirect('/portal');
});

// Captive Portal landing page
router.get('/portal', (req, res) => {
  const { mac, ip, gw_address, gw_port } = req.query;
  
  // Save CoovaChilli parameters to session
  if (mac) req.session.mac = mac;
  if (ip) req.session.ip = ip;
  if (gw_address) req.session.gw_address = gw_address;
  if (gw_port) req.session.gw_port = gw_port;
  
  res.render('portal', { 
    title: 'Welcome to Our Captive Portal',
    error: req.query.error,
    mac: mac || req.session.mac
  });
});

// Voucher Login
router.post('/login', async (req, res) => {
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

    // Check if expired
    if (voucher.status === 'expired') {
      return res.redirect('/portal?error=Voucher has expired');
    }

    // Check limits
    const timeRemaining = voucher.total_duration_allowed - voucher.accumulated_time_used;
    const dataRemaining = voucher.total_data_allowed - voucher.accumulated_data_used;

    if ((voucher.total_duration_allowed > 0 && timeRemaining <= 0) || 
        (voucher.total_data_allowed > 0 && dataRemaining <= 0)) {
      await db.query("UPDATE vouchers SET status = 'expired' WHERE id = $1", [voucher.id]);
      return res.redirect('/portal?error=Voucher has hit limits');
    }

    // Update voucher status and last MAC
    await db.query(
      "UPDATE vouchers SET status = 'active', last_mac_address = $1 WHERE id = $2",
      [mac, voucher.id]
    );

    // Redirect to CoovaChilli
    const { gw_address, gw_port } = req.session;
    if (gw_address && gw_port) {
      const redirectUrl = `http://${gw_address}:${gw_port}/www/login.chi?username=${voucher.username}&password=${voucher.password}`;
      return res.redirect(redirectUrl);
    } else {
      // Fallback if CoovaChilli params are missing
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

// Registration and other routes...
router.get('/register', (req, res) => {
  res.render('register', { title: 'Register', error: null });
});

router.post('/register', async (req, res) => {
  // Implementation for user registration
  res.send('Registration logic here');
});

router.get('/dashboard', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  res.render('dashboard', { title: 'User Dashboard' });
});

module.exports = router;
