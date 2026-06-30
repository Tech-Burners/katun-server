const express = require('express');
const { auth } = require('../../middlewares/auth');
const { getAuditLogsController } = require('./audit.controller');

const router = express.Router();

router.get('/', auth(['hr', 'sub_hr_admin', 'admin', 'sub_admin']), getAuditLogsController);

module.exports = router;
