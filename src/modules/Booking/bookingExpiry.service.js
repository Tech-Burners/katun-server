const axios = require("axios");
const mongoose = require("mongoose");
const bookingModel = require("./booking.model");
const Transaction = require("../Transaction/transaction.model");
const userModel = require("../User/user.model");
const partnerModel = require("../Partner/partner.model");
const serviceModel = require("../Service/service.model");
const payoutCycleModel = require("../Payout/payoutCycle.model");
const { sendNotificationByFcmToken } = require("../../helpers/sendNotificationByFcmToken");
const { addNotificationService } = require("../Notification/notification.service");
const { emailWithNodemailer } = require("../../helpers/email");

/**
 * Calculate bookingRequestExpireAt directly from booking date.
 * 1. If explicit bookingRequestExpireAt is provided, use it.
 * 2. If date is provided, use date directly as the booking expiry / approval deadline.
 * 3. Fall back to (now + 48 hours) if no date is given.
 */
const calculateBookingRequestExpireAt = (data = {}) => {
  if (data.bookingRequestExpireAt) {
    const exp = new Date(data.bookingRequestExpireAt);
    if (!isNaN(exp.getTime())) {
      return exp;
    }
  }

  // Use booking date directly
  if (data.date) {
    const dateVal = new Date(data.date);
    if (!isNaN(dateVal.getTime())) {
      return dateVal;
    }
  }

  // Default fallback: 48 hours from now
  return new Date(Date.now() + 48 * 60 * 60 * 1000);
};

/**
 * Adjust Payout Cycle total amount and remove refunded transaction from cycle.
 */
const adjustPayoutCycleOnRefund = async (transaction) => {
  try {
    if (!transaction?.payoutCycle) {
      return;
    }

    const cycleId = transaction.payoutCycle;
    const cycle = await payoutCycleModel.findById(cycleId);
    if (!cycle || cycle.status === "completed") {
      return;
    }

    // Pull refunded transaction from cycle
    await payoutCycleModel.updateOne(
      { _id: cycleId },
      {
        $pull: { transactions: transaction._id },
      }
    );

    // Recalculate remaining active transactions total
    const activeTransactions = await Transaction.find({
      _id: { $in: cycle.transactions.filter((id) => id.toString() !== transaction._id.toString()) },
      payment_status: "successful",
      payout_status: { $in: ["pending", "hold", "processing"] },
    })
      .select("net_amount")
      .lean();

    const totalAmount = activeTransactions.reduce(
      (sum, item) => sum + Number(item.net_amount || 0),
      0
    );

    await payoutCycleModel.updateOne(
      { _id: cycleId },
      {
        $set: {
          totalAmount: Number(totalAmount.toFixed(2)),
        },
      }
    );
  } catch (err) {
    console.error("❌ Error adjusting payout cycle on refund:", err.message);
  }
};

/**
 * Execute Flutterwave refund with strict idempotency and atomic locking.
 */
const executeFlutterwaveRefund = async (transaction, booking, amount, reason = "Booking request expired") => {
  if (!transaction?._id) {
    return { success: false, reason: "No transaction provided" };
  }

  const refundAmount = Number(amount || transaction.gross_amount);
  if (!refundAmount || refundAmount <= 0) {
    return { success: false, reason: "Invalid refund amount" };
  }

  // Idempotency: Atomically claim refund lock
  const lockedTx = await Transaction.findOneAndUpdate(
    {
      _id: transaction._id,
      payment_status: { $in: ["successful", "paid"] },
      status: { $ne: "refunded" },
      refund_status: { $nin: ["processing", "completed"] },
    },
    {
      $set: {
        refund_status: "processing",
        refund_amount: refundAmount,
        refund_reason: reason,
      },
    },
    { new: true }
  );

  if (!lockedTx) {
    // Check if already refunded
    const currentTx = await Transaction.findById(transaction._id);
    if (currentTx?.refund_status === "completed" || currentTx?.payment_status === "refunded") {
      return { success: true, alreadyRefunded: true, transaction: currentTx };
    }
    if (currentTx?.refund_status === "processing") {
      return { success: false, inProgress: true, reason: "Refund is currently being processed" };
    }
    return { success: false, reason: "Transaction is not in a refundable state" };
  }

  if (!lockedTx.transaction_id) {
    await Transaction.findByIdAndUpdate(lockedTx._id, {
      $set: {
        refund_status: "failed",
        refund_error: "Missing Flutterwave transaction_id",
      },
    });
    return { success: false, reason: "Missing Flutterwave transaction_id" };
  }

  try {
    const flwRes = await axios.post(
      `https://api.flutterwave.com/v3/transactions/${lockedTx.transaction_id}/refund`,
      {
        amount: refundAmount,
        comments: reason,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );

    const flwData = flwRes?.data;
    if (flwData?.status === "success" || flwData?.data?.status === "completed" || flwData?.data?.status === "successful") {
      const refundDetails = flwData.data || {};

      // Requirement 6: Update Transaction safely
      // payment_status = refunded, status = refunded, payout_status = refund
      const updatedTx = await Transaction.findByIdAndUpdate(
        lockedTx._id,
        {
          $set: {
            payment_status: "refunded",
            status: "refunded",
            payout_status: "refund",
            refund_status: "completed",
            refund_id: refundDetails.id ? String(refundDetails.id) : undefined,
            refund_reference: refundDetails.flw_ref || refundDetails.reference || undefined,
            refund_amount: refundAmount,
            refund_at: new Date(),
            refund_reason: reason,
            refund_error: null,
          },
        },
        { new: true }
      );

      // Update booking payment status
      if (booking?._id) {
        await bookingModel.findByIdAndUpdate(booking._id, {
          $set: { paymentStatus: "refunded" },
        });
      }

      // Adjust payout cycle
      await adjustPayoutCycleOnRefund(updatedTx);

      return {
        success: true,
        transaction: updatedTx,
        refundDetails,
      };
    } else {
      throw new Error(flwData?.message || "Flutterwave refund did not return success");
    }
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message || "Flutterwave refund API call failed";
    console.error(`❌ Flutterwave refund failed for transaction ${lockedTx._id}:`, errorMsg);

    // If Flutterwave indicates already refunded, treat as completed
    if (typeof errorMsg === "string" && errorMsg.toLowerCase().includes("already")) {
      const updatedTx = await Transaction.findByIdAndUpdate(
        lockedTx._id,
        {
          $set: {
            payment_status: "refunded",
            status: "refunded",
            payout_status: "refund",
            refund_status: "completed",
            refund_at: new Date(),
            refund_reason: reason,
            refund_error: null,
          },
        },
        { new: true }
      );

      if (booking?._id) {
        await bookingModel.findByIdAndUpdate(booking._id, {
          $set: { paymentStatus: "refunded" },
        });
      }
      await adjustPayoutCycleOnRefund(updatedTx);
      return { success: true, alreadyRefunded: true, transaction: updatedTx };
    }

    // Requirement 8: Keep enough state for safe retry; never mark completed if failed
    await Transaction.findByIdAndUpdate(lockedTx._id, {
      $set: {
        refund_status: "failed",
        refund_error: errorMsg,
      },
    });

    return {
      success: false,
      error: errorMsg,
    };
  }
};

/**
 * Execute Wallet refund with atomic locking and balance credit.
 */
const executeWalletRefund = async (transaction, booking, amount, reason = "Booking request expired") => {
  const refundAmount = Number(amount || booking?.totalPrice || transaction?.gross_amount);
  if (!refundAmount || refundAmount <= 0) {
    return { success: false, reason: "Invalid refund amount" };
  }

  const userId = booking?.user || transaction?.user;
  if (!userId) {
    return { success: false, reason: "No user found for wallet refund" };
  }

  if (transaction?._id) {
    const lockedTx = await Transaction.findOneAndUpdate(
      {
        _id: transaction._id,
        status: { $ne: "refunded" },
        refund_status: { $nin: ["processing", "completed"] },
      },
      {
        $set: {
          refund_status: "processing",
          refund_amount: refundAmount,
          refund_reason: reason,
        },
      },
      { new: true }
    );

    if (!lockedTx) {
      const currentTx = await Transaction.findById(transaction._id);
      if (currentTx?.refund_status === "completed" || currentTx?.payment_status === "refunded") {
        return { success: true, alreadyRefunded: true, transaction: currentTx };
      }
      return { success: false, reason: "Transaction not in refundable state" };
    }

    // Atomically refund wallet credit
    await userModel.findByIdAndUpdate(userId, {
      $inc: { digitalWallet: refundAmount },
    });

    const updatedTx = await Transaction.findByIdAndUpdate(
      lockedTx._id,
      {
        $set: {
          payment_status: "refunded",
          status: "refunded",
          payout_status: "refund",
          refund_status: "completed",
          refund_amount: refundAmount,
          refund_at: new Date(),
          refund_reason: reason,
          refund_error: null,
        },
      },
      { new: true }
    );

    if (booking?._id) {
      await bookingModel.findByIdAndUpdate(booking._id, {
        $set: { paymentStatus: "refunded" },
      });
    }

    await adjustPayoutCycleOnRefund(updatedTx);
    return { success: true, transaction: updatedTx };
  } else {
    // If no transaction doc exists yet, credit wallet directly
    await userModel.findByIdAndUpdate(userId, {
      $inc: { digitalWallet: refundAmount },
    });

    if (booking?._id) {
      await bookingModel.findByIdAndUpdate(booking._id, {
        $set: { paymentStatus: "refunded" },
      });
    }

    return { success: true };
  }
};

/**
 * Notify customer after cancellation & successful refund.
 */
const notifyCustomerRefundSuccess = async (booking, amount, serviceName = "service") => {
  try {
    const userId = booking.user;
    const userDoc = await userModel.findById(userId);

    const title = "Booking Cancelled";
    const message = `Your booking request for ${serviceName} expired without provider approval. A full refund of ₦${amount} has been processed.`;

    if (userDoc?.enabledPushNotification !== false) {
      await sendNotificationByFcmToken(
        userId,
        title,
        message,
        booking._id,
        "booking"
      );
    }

    await addNotificationService({
      sender: booking.provider || undefined,
      targetUser: userId,
      title,
      message,
      type: "booking",
      bookingId: booking._id,
    });

    if (userDoc?.email) {
      await emailWithNodemailer({
        email: userDoc.email,
        subject: title,
        html: `<p>Hello ${userDoc.fullName || "Customer"},</p><p>${message}</p>`,
      }).catch((e) => console.error("Email error:", e.message));
    }
  } catch (err) {
    console.error("❌ Error notifying customer of refund:", err.message);
  }
};

/**
 * Notify customer after cancellation when refund is pending/processing or not applicable.
 */
const notifyCustomerCancellation = async (booking, serviceName = "service", isPendingRefund = false) => {
  try {
    const userId = booking.user;
    const userDoc = await userModel.findById(userId);

    const title = "Booking Request Expired";
    const message = isPendingRefund
      ? `Your booking request for ${serviceName} expired without provider approval and has been cancelled. Your refund is being processed.`
      : `Your booking request for ${serviceName} expired without provider approval and has been cancelled.`;

    if (userDoc?.enabledPushNotification !== false) {
      await sendNotificationByFcmToken(
        userId,
        title,
        message,
        booking._id,
        "booking"
      );
    }

    await addNotificationService({
      sender: booking.provider || undefined,
      targetUser: userId,
      title,
      message,
      type: "booking",
      bookingId: booking._id,
    });

    if (userDoc?.email) {
      await emailWithNodemailer({
        email: userDoc.email,
        subject: title,
        html: `<p>Hello ${userDoc.fullName || "Customer"},</p><p>${message}</p>`,
      }).catch((e) => console.error("Email error:", e.message));
    }
  } catch (err) {
    console.error("❌ Error notifying customer of cancellation:", err.message);
  }
};

/**
 * Process a single expired booking:
 * 1. Atomically mark as cancelled
 * 2. Refund customer safely (Flutterwave / Wallet / Cash)
 * 3. Safely update transactions and payout cycles
 * 4. Notify customer
 */
const processExpiredBooking = async (bookingIdOrDoc) => {
  const bookingId = bookingIdOrDoc._id || bookingIdOrDoc;
  const now = new Date();

  // 1. Atomically cancel if still pending and service appointment time is reached/passed
  const booking = await bookingModel.findOneAndUpdate(
    {
      _id: bookingId,
      status: "pending",
      $or: [
        { bookingRequestExpireAt: { $lte: now } },
        {
          bookingRequestExpireAt: { $exists: false },
          date: { $lte: now },
        },
        {
          bookingRequestExpireAt: null,
          date: { $lte: now },
        },
      ],
    },
    {
      $set: {
        status: "cancelled",
        reason: "Booking request expired without provider approval",
      },
    },
    { new: true }
  );

  if (!booking) {
    // Either already cancelled, approved, or not expired yet
    return null;
  }

  console.log(`⏱️ Auto-cancelling expired booking: ${booking.bookingId || booking._id}`);

  // Fetch service name for notification
  let serviceName = "service";
  try {
    const serviceDoc = await serviceModel.findById(booking.service);
    if (serviceDoc?.name) {
      serviceName = serviceDoc.name;
    }
  } catch (_) {}

  // Find linked transaction
  let transaction = null;
  if (booking.transaction) {
    transaction = await Transaction.findById(booking.transaction);
  }
  if (!transaction) {
    transaction = await Transaction.findOne({
      booking: booking._id,
      paymentType: "booking",
    });
  }

  const paymentMethod = booking.paymentMethod || transaction?.payment_method;
  const isPaid = booking.paymentStatus === "paid" || transaction?.payment_status === "successful";

  // 2. Handle Refund based on payment method
  if (paymentMethod === "cash" || (!isPaid && paymentMethod !== "wallet")) {
    // Cash or unpaid: No monetary refund needed
    await bookingModel.findByIdAndUpdate(booking._id, {
      $set: { paymentStatus: "failed" },
    });
    await notifyCustomerCancellation(booking, serviceName, false);
    return booking;
  }

  if (paymentMethod === "wallet") {
    const refundRes = await executeWalletRefund(
      transaction,
      booking,
      booking.totalPrice || transaction?.gross_amount,
      "Booking request expired without provider approval"
    );

    if (refundRes.success) {
      await notifyCustomerRefundSuccess(
        booking,
        booking.totalPrice || transaction?.gross_amount || 0,
        serviceName
      );
    } else {
      await notifyCustomerCancellation(booking, serviceName, true);
    }
    return booking;
  }

  // Flutterwave digital payment (card, banktransfer, ussd, etc.)
  if (transaction && (transaction.payment_status === "successful" || transaction.payment_status === "paid")) {
    const refundRes = await executeFlutterwaveRefund(
      transaction,
      booking,
      transaction.gross_amount || booking.totalPrice,
      `Booking request ${booking.bookingId || booking._id} expired without provider approval`
    );

    if (refundRes.success) {
      // Requirement 9: Notify customer after confirmed refund
      await notifyCustomerRefundSuccess(
        booking,
        transaction.gross_amount || booking.totalPrice || 0,
        serviceName
      );
    } else {
      // Requirement 8: Refund failed or pending retry; notify cancellation only, not completion
      await notifyCustomerCancellation(booking, serviceName, true);
    }
  } else {
    // No paid transaction found
    await bookingModel.findByIdAndUpdate(booking._id, {
      $set: { paymentStatus: "failed" },
    });
    await notifyCustomerCancellation(booking, serviceName, false);
  }

  return booking;
};

/**
 * Send reminder notification to provider 1 day before provider approval deadline (service time).
 * Uses atomic claim on expiryReminderSent to prevent duplicate notifications.
 */
const sendProviderExpiryReminders = async () => {
  const now = new Date();
  const reminderThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const bookingsToRemind = await bookingModel.find({
    status: "pending",
    expiryReminderSent: { $ne: true },
    $or: [
      {
        bookingRequestExpireAt: {
          $gt: now,
          $lte: reminderThreshold,
        },
      },
      {
        bookingRequestExpireAt: { $exists: false },
        date: {
          $gt: now,
          $lte: reminderThreshold,
        },
      },
      {
        bookingRequestExpireAt: null,
        date: {
          $gt: now,
          $lte: reminderThreshold,
        },
      },
    ],
  });

  for (const b of bookingsToRemind) {
    // Atomically claim the reminder
    const claimedBooking = await bookingModel.findOneAndUpdate(
      {
        _id: b._id,
        status: "pending",
        expiryReminderSent: { $ne: true },
      },
      {
        $set: { expiryReminderSent: true },
      },
      { new: true }
    );

    if (!claimedBooking || !claimedBooking.provider) {
      continue;
    }

    try {
      let serviceName = "service";
      const serviceDoc = await serviceModel.findById(claimedBooking.service);
      if (serviceDoc?.name) {
        serviceName = serviceDoc.name;
      }

      const partnerUser = await userModel.findById(claimedBooking.provider);
      const title = "Booking Request Expiring Soon";
      const message = `You have a pending booking request for ${serviceName} that will expire in less than 24 hours. Please review and approve it.`;

      if (partnerUser?.enabledPushNotification !== false) {
        await sendNotificationByFcmToken(
          claimedBooking.provider,
          title,
          message,
          claimedBooking._id,
          "booking"
        );
      }

      await addNotificationService({
        sender: claimedBooking.user,
        targetUser: claimedBooking.provider,
        title,
        message,
        type: "booking",
        bookingId: claimedBooking._id,
      });

      if (partnerUser?.email) {
        await emailWithNodemailer({
          email: partnerUser.email,
          subject: title,
          html: `<p>Hello ${partnerUser.fullName || "Partner"},</p><p>${message}</p>`,
        }).catch((e) => console.error("Partner reminder email error:", e.message));
      }
    } catch (err) {
      console.error(`❌ Error sending expiry reminder for booking ${b._id}:`, err.message);
    }
  }
};

/**
 * Retry any failed refunds for cancelled bookings.
 */
const retryFailedRefunds = async () => {
  const failedTransactions = await Transaction.find({
    refund_status: "failed",
    payment_status: { $in: ["successful", "paid"] },
    status: { $ne: "refunded" },
  }).limit(20);

  for (const tx of failedTransactions) {
    try {
      const booking = tx.booking ? await bookingModel.findById(tx.booking) : null;
      if (booking && booking.status === "cancelled") {
        console.log(`🔄 Retrying failed refund for transaction: ${tx._id}`);
        const refundRes = await executeFlutterwaveRefund(
          tx,
          booking,
          tx.gross_amount,
          "Retry refund for expired cancelled booking"
        );
        if (refundRes.success) {
          let serviceName = "service";
          if (booking.service) {
            const svc = await serviceModel.findById(booking.service);
            if (svc?.name) serviceName = svc.name;
          }
          await notifyCustomerRefundSuccess(booking, tx.gross_amount, serviceName);
        }
      }
    } catch (err) {
      console.error(`❌ Error retrying refund for transaction ${tx._id}:`, err.message);
    }
  }
};

/**
 * Cron runner:
 * 1. Send 24h expiry reminders to providers
 * 2. Cancel and refund expired pending bookings (when service appointment time has arrived/passed)
 * 3. Retry previously failed refunds
 */
const processAllExpiredBookings = async () => {
  const now = new Date();

  // 1. Send reminders
  await sendProviderExpiryReminders();

  // 2. Find and cancel expired pending bookings
  const expiredBookings = await bookingModel
    .find({
      status: "pending",
      $or: [
        { bookingRequestExpireAt: { $lte: now } },
        {
          bookingRequestExpireAt: { $exists: false },
          date: { $lte: now },
        },
        {
          bookingRequestExpireAt: null,
          date: { $lte: now },
        },
      ],
    })
    .limit(50);

  for (const b of expiredBookings) {
    try {
      await processExpiredBooking(b);
    } catch (err) {
      console.error(`❌ Error processing expired booking ${b._id}:`, err.message);
    }
  }

  // 3. Retry failed refunds
  await retryFailedRefunds();
};

module.exports = {
  calculateBookingRequestExpireAt,
  adjustPayoutCycleOnRefund,
  executeFlutterwaveRefund,
  executeWalletRefund,
  notifyCustomerRefundSuccess,
  notifyCustomerCancellation,
  processExpiredBooking,
  sendProviderExpiryReminders,
  processAllExpiredBookings,
  retryFailedRefunds,
};
