const express = require('express');
const { homeController, allNerestController } = require('./home.controller');
const { auth } = require('../../middlewares/auth');
const router = express.Router();

router.post('/home', auth(['user']), homeController)
router.post('/all-nearest', auth(['user']), allNerestController)

module.exports = router