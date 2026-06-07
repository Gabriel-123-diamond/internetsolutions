const db = require('../config/db');

class AdminService {
  async getDashboardStats() {
    const stats = {
      totalVouchers: (await db.query('SELECT COUNT(*) FROM vouchers')).rows[0].count,
      activeVouchers: (await db.query("SELECT COUNT(*) FROM vouchers WHERE status = 'active'")).rows[0].count,
      totalRevenue: (await db.query('SELECT SUM(p.price) FROM vouchers v JOIN plans p ON v.plan_id = p.id')).rows[0].sum || 0,
      totalUsers: (await db.query("SELECT COUNT(*) FROM users WHERE role = 'user'")).rows[0].count
    };
    return stats;
  }

  async getRecentSales(limit = 10) {
    const result = await db.query(`
      SELECT v.*, p.name as plan_name, p.price, u.email as user_email 
      FROM vouchers v 
      JOIN plans p ON v.plan_id = p.id 
      LEFT JOIN users u ON v.user_id = u.id 
      ORDER BY v.created_at DESC LIMIT $1
    `, [limit]);
    return result.rows;
  }

  async addPlan(name, price, durationHours, dataGb) {
    const duration_seconds = parseInt(durationHours) * 3600;
    const data_bytes = parseInt(dataGb) * 1024 * 1024 * 1024;
    await db.query(
      'INSERT INTO plans (name, price, duration_seconds, data_bytes) VALUES ($1, $2, $3, $4)',
      [name, price, duration_seconds, data_bytes]
    );
  }

  async deletePlan(planId) {
    await db.query('DELETE FROM plans WHERE id = $1', [planId]);
  }
}

module.exports = new AdminService();
