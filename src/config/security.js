const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const setupSecurity = (app) => {
  // Helmet configuration - Explicitly disabling HSTS and Upgrade-Insecure-Requests for HTTP testing
  app.use(helmet({
    hsts: false, // Disable HSTS to prevent browsers from forcing HTTPS
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "cdnjs.cloudflare.com", "https://js.paystack.co"],
        styleSrc: ["'self'", "cdnjs.cloudflare.com", "fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "cdnjs.cloudflare.com", "fonts.gstatic.com"],
        connectSrc: ["'self'", "https://api.paystack.co"],
        imgSrc: ["'self'", "data:", "https://www.google-analytics.com"],
        frameSrc: ["'self'", "https://js.paystack.co"],
        upgradeInsecureRequests: null // Disable automatic HTTPS upgrades
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
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  });

  app.use('/login', loginLimiter);
  app.use('/register', loginLimiter);
  app.use('/api/payment/initiate', loginLimiter);
};

module.exports = setupSecurity;
