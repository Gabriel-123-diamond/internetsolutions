const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
require('dotenv').config();

const setupSecurity = require('./config/security');
const sessionMiddleware = require('./config/session');

const app = express();

// Security & Proxy
setupSecurity(app);
app.set('trust proxy', 1);

// Body parsing
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true }));

// Session
app.use(sessionMiddleware);

// View Context Locals
app.use((req, res, next) => {
  res.locals.PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  res.locals.session = req.session;
  next();
});

// View Engine
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', require('./routes/portal'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/session', require('./routes/session'));
app.use('/admin', require('./routes/admin'));

// Diagnostics
app.get('/api/session-check', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    userId: req.session.userId,
    role: req.session.role,
    env: process.env.NODE_ENV,
    secure: req.secure
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { error: 'Something went wrong!', title: 'Error' });
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
