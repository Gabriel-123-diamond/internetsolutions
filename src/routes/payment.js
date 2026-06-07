const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/initiate', (req, res) => paymentController.initiate(req, res));
router.get('/success', (req, res) => paymentController.handleSuccess(req, res));
router.post('/webhook', (req, res) => paymentController.handleWebhook(req, res));

module.exports = router;
