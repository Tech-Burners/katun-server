const express = require("express");
const {
  sendTransactionEmailController,
  initializePayment,
  verifyPayment,
  bookController,
  cancelBooking,
  allTransactionController,
  pendingPayoutController,
  statusUpdateController,
  completeMonthlyPayoutController,
  payoutStatusUpdateController,
  allPayoutController,
  partnerMonthlySummaryController,
  holdPayoutController,
  doCompletePayoutController,
  partnerMonthlyCompletedPayoutController,
  earningController,
  purchaseCreditController,
  allPayoutOfAPartnerController,
  refundController,
  withdrawCreditController,
  tipsController,
  getBanks,
} = require("./transaction.controller");
const { auth } = require("../../middlewares/auth");
const { default: status } = require("http-status");

const router = express.Router();


router.post("/send-email", auth(['user', 'partner', 'admin', 'sub_admin', 'hr']), sendTransactionEmailController);
router.post("/:transactionId/send-email", auth(['user', 'partner', 'admin', 'sub_admin', 'hr']), sendTransactionEmailController);
router.patch("/cancel/:bookingId", auth(['user', 'partner']), cancelBooking);
router.patch("/hold", holdPayoutController);
router.patch("/complete", auth(['admin', 'sub_admin']), doCompletePayoutController);
router.post("/book", auth(['user']), bookController)
router.post("/purchase-credit", auth(['user', 'partner', 'hr']), purchaseCreditController)
router.post("/tips", auth(['user', 'partner', 'hr']), tipsController)
router.post("/", initializePayment);
router.get("/partner/all-payout", auth(['partner']), allPayoutOfAPartnerController);
router.patch("/withdraw-credit", auth(['partner', 'user']), withdrawCreditController);
router.get("/all-transaction", allTransactionController);
router.get("/earning", earningController);
router.get("/getBanks", getBanks);
router.get("/getBanks/:country", getBanks);
router.get("/success", (req, res) => { res.status(status.OK).json({ message: "Payment successful" })});
router.get("/all-payout", allPayoutController);
router.get("/refund", refundController);
// router.get("/pending-payout", partnerMonthlySummaryController);
router.get("/complete-payout", partnerMonthlyCompletedPayoutController);


module.exports = router;
