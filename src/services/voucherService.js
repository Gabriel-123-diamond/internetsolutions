const db = require('../config/db');
const crypto = require('crypto');

class VoucherService {
  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  generateToken() {
    return crypto.randomBytes(16).toString('base64url');
  }

  async getAllPlans() {
    const result = await db.query('SELECT * FROM plans ORDER BY price ASC');
    return result.rows;
  }

  async getVoucherByCode(code) {
    const result = await db.query(
      'SELECT v.*, p.duration_seconds, p.data_bytes FROM vouchers v JOIN plans p ON v.plan_id = p.id WHERE v.username = $1',
      [code]
    );
    return result.rows[0] || null;
  }

  async verifyVoucherLimits(voucher) {
    if (voucher.status === 'expired') return { valid: false, error: 'Voucher has expired' };

    const timeRemaining = voucher.total_duration_allowed - voucher.accumulated_time_used;
    const dataRemaining = voucher.total_data_allowed - voucher.accumulated_data_used;

    if ((voucher.total_duration_allowed > 0 && timeRemaining <= 0) || 
        (voucher.total_data_allowed > 0 && dataRemaining <= 0)) {
      await db.query("UPDATE vouchers SET status = 'expired' WHERE id = $1", [voucher.id]);
      return { valid: false, error: 'Voucher has hit limits' };
    }

    return { valid: true };
  }

  async activateVoucher(voucherId, mac) {
    await db.query(
      "UPDATE vouchers SET status = 'active', last_mac_address = $1 WHERE id = $2",
      [mac, voucherId]
    );
  }

  async getUserVouchers(userId) {
    const result = await db.query(
      'SELECT v.*, p.name as plan_name FROM vouchers v JOIN plans p ON v.plan_id = p.id WHERE v.user_id = $1 ORDER BY v.created_at DESC',
      [userId]
    );
    return result.rows;
  }
}

module.exports = new VoucherService();
