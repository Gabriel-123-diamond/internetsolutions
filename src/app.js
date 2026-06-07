const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const rateLimit = require('express-rate-limit');
const db = require('./config/db');
require('dotenv').config();

const app = express();

// Security configuration with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "cdnjs.cloudflare.com", "https://js.paystack.co"],
      styleSrc: ["'self'", "cdnjs.cloudflare.com", "fonts.googleapis.com", "'unsafe-inline'"],
      fontSrc: ["'self'", "cdnjs.cloudflare.com", "fonts.gstatic.com"],
      connectSrc: ["'self'", "https://api.paystack.co"],
      imgSrc: ["'self'", "data:", "https://www.google-analytics.com"],
      frameSrc: ["'self'", "https://js.paystack.co"]
    }
  }
}));

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/login', limiter);
app.use('/register', limiter);
app.use('/api/payment/initiate', limiter);

// Body parsing with rawBody extraction for webhook verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Global variables for views
app.use((req, res, next) => {
  res.locals.PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  res.locals.session = req.session;
  next();
});

app.set('trust proxy', 1); // Trust first proxy (Vercel)

if (!process.env.SESSION_SECRET) {
  console.warn('WARNING: SESSION_SECRET is not defined. Sessions will not be secure and may be lost on restart.');
}

// Session configuration
app.use(session({
  store: new pgSession({
    pool: db.pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production'
  }
}));

// View engine setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');
app.use(express.static(path.join(__dirname, 'public')));

// Routes (to be added)
const portalRoutes = require('./routes/portal');
const paymentRoutes = require('./routes/payment');
const sessionRoutes = require('./routes/session');
const adminRoutes = require('./routes/admin');

app.use('/', portalRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/session', sessionRoutes);
app.get('/api/session-check', (req, res) => {
  res.json({
    sessionID: req.sessionID,
    userId: req.session.userId,
    role: req.session.role,
    cookie: req.session.cookie,
    env: process.env.NODE_ENV,
    secure: req.secure,
    headers: req.headers
  });
});
app.use('/admin', adminRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { error: 'Something went wrong!', title: 'Error' });
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
