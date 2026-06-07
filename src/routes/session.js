const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

router.post('/pause', (req, res) => sessionController.pause(req, res));

module.exports = router;
