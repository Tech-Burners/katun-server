const express = require('express');
const { homeController, allNerestController } = require('./home.controller');
const { auth } = require('../../middlewares/auth');
const router = express.Router();

router.get('/home', auth(['user'], { optional: true }), homeController);
router.post('/home', auth(['user'], { optional: true }), homeController);
router.get(
  "/all-nearest",
  auth(["user"], { optional: true }),
  allNerestController
);
router.post(
  "/all-nearest",
  auth(["user"], { optional: true }),
  allNerestController
);
module.exports = router