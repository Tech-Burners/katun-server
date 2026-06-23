const express = require("express");
const router = express.Router();
const {auth} = require("../../middlewares/auth");
const { getPendingPayoutController, updatePayoutFrequencyController, holdPayoutController, completePayoutController, getMyFrequencyController } = require("./payout.controller");

router.get("/pending", getPendingPayoutController);
router.get("/my-frequency", auth(['partner']), getMyFrequencyController);
router.patch("/update-frequency", auth(['partner']), updatePayoutFrequencyController);
router.patch("/:cycleId/hold", auth("admin"), holdPayoutController);
router.patch("/:cycleId/complete", auth("admin"), completePayoutController);


module.exports = router;