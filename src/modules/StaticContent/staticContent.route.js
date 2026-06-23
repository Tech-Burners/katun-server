const express = require('express');
const { upgradeStaticContent, getAllStaticContent } = require('./staticContent.controller');
const router = express.Router();
const { auth } = require('../../middlewares/auth');

router.post('/',   auth(['admin']), upgradeStaticContent);
router.get('/', getAllStaticContent);

module.exports = router;