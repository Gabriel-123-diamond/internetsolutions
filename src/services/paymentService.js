const axios = require('axios');
require('dotenv').config();

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

class PaymentService {
  async initializeTransaction(email, amount, metadata, callbackUrl) {
    const response = await axios.post('https://api.paystack.co/transaction/initialize', {
      email,
      amount,
      callback_url: callbackUrl,
      metadata
    }, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.data;
  }

  async verifyTransaction(reference) {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` }
    });
    return response.data.data;
  }
}

module.exports = new PaymentService();
