const db = require('../config/db');

const isAuthenticated = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/login?error=Please login to access this page');
};

const isAdmin = async (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login?error=Please login as admin');
  }
  
  try {
    const result = await db.query('SELECT role FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length > 0 && result.rows[0].role === 'admin') {
      return next();
    }
    res.redirect('/dashboard?error=Access denied. Admin only.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  isAuthenticated,
  isAdmin
};
