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
const { flutterwaveCallback, renderPaymentPage, executePaymentProcessing } = require("../../helpers/flutterWaveWebhook");
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
router.get("/verify", verifyPayment);
router.post("/verify", verifyPayment);
router.get("/verify/:tx_ref", verifyPayment);
// router.get("/success", flutterwaveCallback);
router.get("/success", (req, res) => {
  const { status: paymentStatus, tx_ref: txRef, transaction_id: transactionId } = req.query;

  // Background sync if payment was successful and not yet verified
  if (paymentStatus === "successful" && (transactionId || txRef)) {
    executePaymentProcessing({ transactionId, txRef }).catch((err) =>
      console.error("Background payment processing error on /success:", err.message)
    );
  }

  // If client explicitly requests JSON
  const accept = req.headers?.accept || "";
  if (req.query?.format === "json" || (accept.includes("application/json") && !accept.includes("text/html"))) {
    return res.status(status.OK).json({
      status: "success",
      statusCode: status.OK,
      message: "Payment Successful",
      data: { tx_ref: txRef, transaction_id: transactionId },
    });
  }

  // Render clean, modern Payment Successful page
  const isCancelled = paymentStatus === "cancelled";
  return res.status(status.OK).send(
    renderPaymentPage({
      success: !isCancelled,
      title: isCancelled ? "Payment Cancelled" : "Payment Successful!",
      message: isCancelled
        ? "You cancelled the payment process. No charges were made."
        : "Your payment has been received and processed successfully.",
      txRef,
      transactionId,
    })
  );
});
router.get("/all-payout", allPayoutController);
router.get("/refund", refundController);
// router.get("/pending-payout", partnerMonthlySummaryController);
router.get("/complete-payout", partnerMonthlyCompletedPayoutController);


module.exports = router;
