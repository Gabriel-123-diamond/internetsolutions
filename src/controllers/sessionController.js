const { Client } = require('ssh2');
const db = require('../config/db');

class SessionController {
  async pause(req, res) {
    const { voucherId, mac } = req.body;
    if (!mac) return res.status(400).json({ error: 'MAC address is required' });

    const conn = new Client();
    conn.on('ready', () => {
      conn.exec(`chilli_query logout ${mac}`, async (err, stream) => {
        if (err) {
          conn.end();
          return res.status(500).json({ error: 'SSH Command failed' });
        }
        stream.on('close', async () => {
          conn.end();
          try {
            await db.query("UPDATE vouchers SET status = 'paused' WHERE id = $1", [voucherId]);
            res.json({ success: true });
          } catch (dbErr) {
            res.status(500).json({ error: 'DB Update failed' });
          }
        });
      });
    }).on('error', (err) => {
      res.status(500).json({ error: 'SSH Connection failed' });
    }).connect({
      host: process.env.ROUTER_SSH_HOST,
      port: process.env.ROUTER_SSH_PORT || 22,
      username: process.env.ROUTER_SSH_USER || 'root',
      password: process.env.ROUTER_SSH_PASSWORD
    });
  }
}

module.exports = new SessionController();
