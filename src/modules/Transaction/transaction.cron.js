const cron = require("node-cron");
const axios = require("axios");
const Transaction = require("./transaction.model");
const { executePaymentProcessing } = require("../../helpers/flutterWaveWebhook");

let isReconciling = false;

/**
 * Reconciles pending transactions by verifying them directly with Flutterwave API.
 * Catches any transactions where payment was completed but webhook/redirect failed.
 */
const reconcilePendingTransactions = async () => {
  if (!process.env.FLW_SECRET_KEY) {
    return;
  }

  // Grace period: ignore transactions created in the last 60 seconds (user still in checkout)
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  // Scan transactions created in the last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const pendingTransactions = await Transaction.find({
    payment_status: "pending",
    tx_ref: { $exists: true, $ne: null },
    createdAt: { $gte: twentyFourHoursAgo, $lte: oneMinuteAgo },
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  if (!pendingTransactions || pendingTransactions.length === 0) {
    return;
  }

  console.log(`[Reconciliation] Checking ${pendingTransactions.length} pending transactions...`);

  for (const t of pendingTransactions) {
    try {
      const res = await axios.get(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(t.tx_ref)}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          },
          timeout: 10000,
        }
      );

      const flwData = res.data?.data;
      if (flwData?.status === "successful") {
        console.log(`[Reconciliation] Successfully found paid transaction: ${t.tx_ref} (FLW ID: ${flwData.id}). Processing booking...`);
        const result = await executePaymentProcessing({
          txRef: t.tx_ref,
          transactionId: flwData.id,
        });

        if (result?.success) {
          console.log(`[Reconciliation] Transaction ${t.tx_ref} processed successfully. Booking: ${result.booking?._id}`);
        } else {
          console.error(`[Reconciliation] Failed to process ${t.tx_ref}:`, result?.message);
        }
      }
    } catch (err) {
      // 404 from Flutterwave means payment was not initiated/paid by customer yet
      if (err.response?.status !== 404) {
        console.error(`[Reconciliation] Error checking tx_ref ${t.tx_ref}:`, err.response?.data?.message || err.message);
      }
    }
  }
};

/**
 * Initializes the reconciliation cron job running every 2 minutes.
 */
const startTransactionCron = () => {
  cron.schedule("*/2 * * * *", async () => {
    if (isReconciling) {
      console.log("⏳ Transaction reconciliation already running, skipping overlapping tick.");
      return;
    }

    isReconciling = true;
    try {
      await reconcilePendingTransactions();
    } catch (error) {
      console.error("❌ Transaction reconciliation cron error:", error.message);
    } finally {
      isReconciling = false;
    }
  });

  console.log("🕒 Transaction reconciliation cron job initialized (running every 2 minutes)");
};

module.exports = {
  startTransactionCron,
  reconcilePendingTransactions,
};
