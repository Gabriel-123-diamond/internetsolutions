const express = require('express');
const router = express.Router();
const { Client } = require('ssh2');
const db = require('../config/db');

// Remote Session Pausing via SSH
router.post('/pause', async (req, res) => {
  const { voucherId, mac } = req.body;

  if (!mac) {
    return res.status(400).json({ error: 'MAC address is required' });
  }

  const conn = new Client();
  
  conn.on('ready', () => {
    console.log('SSH Client Ready');
    conn.exec(`chilli_query logout ${mac}`, async (err, stream) => {
      if (err) {
        conn.end();
        return res.status(500).json({ error: 'Failed to execute logout command' });
      }
      
      stream.on('close', async (code, signal) => {
        console.log('SSH Stream closed with code: ' + code);
        conn.end();
        
        try {
          // Update voucher state in DB
          await db.query(
            "UPDATE vouchers SET status = 'paused' WHERE id = $1",
            [voucherId]
          );
          res.json({ success: true, message: 'Session paused and user logged out' });
        } catch (dbErr) {
          console.error(dbErr);
          res.status(500).json({ error: 'Failed to update voucher status' });
        }
      }).on('data', (data) => {
        console.log('STDOUT: ' + data);
      }).stderr.on('data', (data) => {
        console.log('STDERR: ' + data);
      });
    });
  }).on('error', (err) => {
    console.error('SSH Error:', err);
    res.status(500).json({ error: 'SSH Connection failed' });
  }).connect({
    host: process.env.ROUTER_SSH_HOST,
    port: 22,
    username: process.env.ROUTER_SSH_USER || 'root',
    password: process.env.ROUTER_SSH_PASSWORD
    // privateKey: require('fs').readFileSync('/path/to/key') // Alternative
  });
});

module.exports = router;
