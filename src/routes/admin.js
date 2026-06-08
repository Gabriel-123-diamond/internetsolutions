const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');
const { isAdmin } = require('../middleware/auth');

// Public Admin Login
router.get('/login', (req, res) => adminController.renderLogin(req, res));
router.post('/login', (req, res) => adminController.login(req, res));

// Protected Admin Routes
router.use(isAdmin);
router.get('/', (req, res) => adminController.renderDashboard(req, res));
router.get('/settings', (req, res) => adminController.renderSettings(req, res));
router.post('/change-password', (req, res) => authController.changePassword(req, res));
router.get('/plans', (req, res) => adminController.renderPlans(req, res));
router.post('/plans/add', (req, res) => adminController.addPlan(req, res));
router.post('/plans/delete/:id', (req, res) => adminController.deletePlan(req, res));

module.exports = router;
