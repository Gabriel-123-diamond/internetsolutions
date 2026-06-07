const paymentService = require('../services/paymentService');
const voucherService = require('../services/voucherService');
const db = require('../config/db');
const crypto = require('crypto');

class PaymentController {
  async initiate(req, res) {
    const { planId, email } = req.body;
    const mac = req.session.mac;
    const userId = req.session.userId || null;

    try {
      const plans = await voucherService.getAllPlans();
      const plan = plans.find(p => p.id == planId);
      if (!plan) return res.status(404).json({ error: 'Plan not found' });

      const callbackUrl = `${req.protocol}://${req.get('host')}/api/payment/success`;
      const metadata = { planId, userId, mac };

      const transaction = await paymentService.initializeTransaction(email, Math.round(plan.price * 100), metadata, callbackUrl);
      res.json(transaction);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to initiate payment' });
    }
  }

  async handleSuccess(req, res) {
    const { reference } = req.query;
    try {
      const data = await paymentService.verifyTransaction(reference);
      if (data.status === 'success') {
        const voucher = await this.createVoucher(reference, data.metadata);
        res.render('payment_success', { title: 'Payment Successful', voucher });
      } else {
        res.render('error', { title: 'Payment Failed', error: 'Payment verification failed.' });
      }
    } catch (err) {
      console.error(err);
      res.render('error', { title: 'Error', error: 'Internal server error during verification.' });
    }
  }

  async handleWebhook(req, res) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto.createHmac('sha512', secret).update(req.rawBody).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) return res.status(401).send('Invalid signature');

    const event = req.body;
    if (event.event === 'charge.success') {
      try {
        await this.createVoucher(event.data.reference, event.data.metadata);
        res.status(200).send('Webhook processed');
      } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).send('Error processing webhook');
      }
    } else {
      res.status(200).send('Event ignored');
    }
  }

  async createVoucher(paymentRef, metadata) {
    const { planId, userId, mac } = metadata;
    for (let attempt = 0; attempt < 5; attempt++) {
      const voucherCode = voucherService.generateCode();
      const token = voucherService.generateToken();

      try {
        const existing = await db.query('SELECT * FROM vouchers WHERE payment_reference = $1', [paymentRef]);
        if (existing.rows.length > 0) return existing.rows[0];

        const plans = await voucherService.getAllPlans();
        const plan = plans.find(p => p.id == planId);

        const result = await db.query(
          `INSERT INTO vouchers (user_id, username, password, plan_id, total_duration_allowed, total_data_allowed, status, last_mac_address, payment_reference) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [userId, voucherCode, token, planId, plan.duration_seconds, plan.data_bytes, 'unused', mac, paymentRef]
        );
        return result.rows[0];
      } catch (err) {
        if (err.code === '23505') {
          if (err.detail.includes('payment_reference')) {
            const existing = await db.query('SELECT * FROM vouchers WHERE payment_reference = $1', [paymentRef]);
            return existing.rows[0];
          }
          continue;
        }
        throw err;
      }
    }
    throw new Error('Failed to generate unique voucher code');
  }
}

module.exports = new PaymentController();
