const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');
const authController = require('../controllers/authController');

// Main Portal
router.get('/', (req, res) => res.redirect('/portal'));
router.get('/portal', (req, res) => portalController.renderPortal(req, res));
router.post('/login/voucher', (req, res) => portalController.loginVoucher(req, res));

// Auth (User Accounts)
router.get('/login', (req, res) => res.render('login', { title: 'User Login', error: req.query.error, notice: req.query.notice }));
router.post('/login', (req, res) => authController.login(req, res));
router.get('/register', (req, res) => res.render('register', { title: 'Register', error: req.query.error }));
router.post('/register', (req, res) => authController.register(req, res));
router.get('/logout', (req, res) => authController.logout(req, res));

// User Dashboard & Settings
router.get('/dashboard', (req, res) => portalController.renderDashboard(req, res));
router.get('/settings', (req, res) => portalController.renderSettings(req, res));
router.post('/settings/change-password', (req, res) => authController.changePassword(req, res));

module.exports = router;
