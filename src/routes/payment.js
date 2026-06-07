const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/db');

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// Helper to generate 6-character voucher code
function generateVoucherCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars: I, O, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper to generate secure password/token
function generateToken() {
  return crypto.randomBytes(16).toString('base64url');
}

// Initiate Payment
router.post('/initiate', async (req, res) => {
  const { planId, email } = req.body;
  const mac = req.session.mac;
  const userId = req.session.userId || null;

  try {
    const planResult = await db.query('SELECT * FROM plans WHERE id = $1', [planId]);
    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    const plan = planResult.rows[0];

    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      email: email,
      amount: Math.round(plan.price * 100), // Minor currency (Kobo)
      callback_url: `${req.protocol}://${req.get('host')}/api/payment/success`,
      metadata: {
        planId,
        userId,
        mac,
        custom_fields: [
          { display_name: "Plan", variable_name: "plan", value: plan.name },
          { display_name: "MAC Address", variable_name: "mac", value: mac }
        ]
      }
    }, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
});

// Create Voucher (Shared between success route and webhook)
async function createVoucher(paymentRef, metadata) {
  const { planId, userId, mac } = metadata;
  
  // Optimistic concurrency loop for unique code generation
  for (let attempt = 0; attempt < 5; attempt++) {
    const voucherCode = generateVoucherCode();
    const token = generateToken();

    try {
      // Check if already created (Idempotency)
      const existing = await db.query('SELECT * FROM vouchers WHERE payment_reference = $1', [paymentRef]);
      if (existing.rows.length > 0) return existing.rows[0];

      const planResult = await db.query('SELECT * FROM plans WHERE id = $1', [planId]);
      const plan = planResult.rows[0];

      const result = await db.query(
        `INSERT INTO vouchers (
          user_id, username, password, plan_id, 
          total_duration_allowed, total_data_allowed, 
          status, last_mac_address, payment_reference
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          userId, voucherCode, token, planId, 
          plan.duration_seconds, plan.data_bytes, 
          'unused', mac, paymentRef
        ]
      );
      return result.rows[0];
    } catch (err) {
      if (err.code === '23505') { // Unique violation
        // If it's the payment_reference that's duplicate, return existing
        if (err.detail.includes('payment_reference')) {
          const existing = await db.query('SELECT * FROM vouchers WHERE payment_reference = $1', [paymentRef]);
          return existing.rows[0];
        }
        // If it's the username, retry the loop
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to generate unique voucher code after 5 attempts');
}

// Payment Callback/Success
router.get('/success', async (req, res) => {
  const { trxref, reference } = req.query;
  const ref = reference || trxref;

  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${ref}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
    });

    if (response.data.data.status === 'success') {
      const voucher = await createVoucher(ref, response.data.data.metadata);
      res.render('payment_success', { title: 'Payment Successful', voucher });
    } else {
      res.render('error', { title: 'Payment Failed', error: 'Payment verification failed.' });
    }
  } catch (err) {
    console.error(err);
    res.render('error', { title: 'Error', error: 'Internal server error during verification.' });
  }
});

// Paystack Webhook
router.post('/webhook', async (req, res) => {
  const hash = crypto.createHmac('sha512', PAYSTACK_SECRET).update(req.rawBody).digest('hex');
  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;
  if (event.event === 'charge.success') {
    try {
      await createVoucher(event.data.reference, event.data.metadata);
      res.status(200).send('Webhook processed');
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(500).send('Error processing webhook');
    }
  } else {
    res.status(200).send('Event ignored');
  }
});

module.exports = router;
