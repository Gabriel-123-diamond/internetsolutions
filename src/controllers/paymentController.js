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
        const voucher = await voucherService.createVoucherAfterPayment(reference, data.metadata);
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
        await voucherService.createVoucherAfterPayment(event.data.reference, event.data.metadata);
        res.status(200).send('Webhook processed');
      } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).send('Error processing webhook');
      }
    } else {
      res.status(200).send('Event ignored');
    }
  }
}

module.exports = new PaymentController();
