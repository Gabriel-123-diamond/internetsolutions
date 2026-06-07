const db = require('../config/db');

const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login?error=Please login to access this page');
};

const isAdmin = async (req, res, next) => {
  console.log('--- isAdmin Check ---');
  console.log('Session ID:', req.sessionID);
  console.log('User ID in session:', req.session.userId);
  console.log('Role in session:', req.session.role);

  if (!req.session.userId) {
    console.log('Access Denied: No userId in session');
    return res.redirect('/admin/login?error=Please login as admin');
  }
  
  if (req.session.userId === 'admin-master') {
    console.log('Access Granted: admin-master detected');
    return next();
  }

  try {
    const result = await db.query('SELECT role FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length > 0 && result.rows[0].role === 'admin') {
      console.log('Access Granted: Database verified admin role');
      return next();
    }
    console.log('Access Denied: User role is not admin');
    res.redirect('/dashboard?error=Access denied. Admin only.');
  } catch (err) {
    console.error('isAdmin Error:', err);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  isAuthenticated,
  isAdmin
};
