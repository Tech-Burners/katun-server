const express = require("express");
const { addFeedbackController, getFeedbackController, getMyFeedbackController, replyController, serviceFeedbackController, partnerFeedbackController } = require("./feedback.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();

router.post("/add",auth(['partner']), addFeedbackController);
router.get('/my-feedback',auth(['partner']), getMyFeedbackController);
router.get('/service/:serviceId', serviceFeedbackController);
router.get('/partner/:partnerId', partnerFeedbackController);
router.post("/reply",auth(['partner']), replyController);

module.exports = router;