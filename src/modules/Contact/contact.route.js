const express = require('express');
const { sendContactController } = require('./contact.controller');
const { auth } = require('../../middlewares/auth');
const router = express.Router();

router.post('/', sendContactController);

module.exports = router;