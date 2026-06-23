const express = require('express');
const { auth } = require('../../middlewares/auth');
const { getAuditLogsController } = require('./audit.controller');

const router = express.Router();

router.get('/', auth(['admin', 'hr']), getAuditLogsController);

module.exports = router;
