const axios = require("axios");
const Transaction = require("../modules/Transaction/transaction.model");
const bookingModel = require("../modules/Booking/booking.model");
const serviceModel = require("../modules/Service/service.model");
const userModel = require("../modules/User/user.model");
const partnerModel = require("../modules/Partner/partner.model");
const employerModel = require("../modules/Employer/employer.model");
const payoutCycleModel = require("../modules/Payout/payoutCycle.model");
const { sendNotificationByFcmToken } = require("./sendNotificationByFcmToken");
const { addNotificationService } = require("../modules/Notification/notification.service");
const { emailWithNodemailer } = require("./email");
const { sendTransactionEmail } = require("./emailNotification");
const {
  calculateBookingRequestExpireAt,
  sendNewBookingNotifications,
  getAppointmentStartTime,
} = require("../modules/Booking/bookingExpiry.service");

// =====================================================
// NORMALIZE PAYMENT METHOD
// =====================================================
const normalizePaymentMethod = (method) => {
  if (!method) return "card";
  const value = String(method).toLowerCase();
  if (value.includes("card")) return "card";
  if (value.includes("bank")) return "banktransfer";
  if (value.includes("ussd")) return "ussd";
  if (value.includes("wallet")) return "wallet";
  return "card";
};

// =====================================================
// VERIFY PAYMENT DIRECTLY WITH FLUTTERWAVE
// =====================================================
const verifyFlutterwavePayment = async (transactionId, txRef) => {
  if (!process.env.FLW_SECRET_KEY) {
    throw new Error("FLW_SECRET_KEY is not configured in environment variables");
  }

  let url = null;
  if (transactionId) {
    url = `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`;
  } else if (txRef) {
    url = `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;
  } else {
    return null;
  }

  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
    },
    timeout: 15000,
  });

  return response?.data?.data;
};

// =====================================================
// UPDATE PAYOUT CYCLE
// =====================================================
const updatePayoutCycle = async (transaction) => {
  if (!transaction.payoutCycle) {
    return;
  }

  await payoutCycleModel.updateOne(
    {
      _id: transaction.payoutCycle,
      status: { $ne: "completed" },
    },
    {
      $addToSet: {
        transactions: transaction._id,
      },
    }
  );

  const cycle = await payoutCycleModel.findById(transaction.payoutCycle);
  if (!cycle) {
    return;
  }

  const transactions = await Transaction.find({
    _id: { $in: cycle.transactions },
    payment_status: { $in: ["successful", "paid"] },
    payout_status: { $in: ["pending", "hold", "processing"] },
  })
    .select("net_amount")
    .lean();

  const totalAmount = transactions.reduce((total, item) => {
    return total + Number(item.net_amount || 0);
  }, 0);

  await payoutCycleModel.updateOne(
    { _id: cycle._id },
    { $set: { totalAmount: Number(totalAmount.toFixed(2)) } }
  );
};

// =====================================================
// CORE PAYMENT EXECUTION / ATOMIC PROCESSING
// =====================================================
const executePaymentProcessing = async ({ transactionId, txRef }) => {
  let transaction = null;

  // 1. Locate Transaction
  if (txRef) {
    transaction = await Transaction.findOne({ tx_ref: txRef });
  }
  if (!transaction && transactionId) {
    transaction = await Transaction.findOne({ transaction_id: transactionId });
  }

  if (!transaction) {
    console.error("Payment processing: Transaction not found:", { txRef, transactionId });
    return {
      success: false,
      code: "TRANSACTION_NOT_FOUND",
      message: `Transaction record not found for reference: ${txRef || transactionId}`,
    };
  }

  // 2. Duplicate / Already Processed Check
  if (transaction.payment_status === "successful") {
    let booking = null;
    if (transaction.booking) {
      booking = await bookingModel.findById(transaction.booking);
    }
    return {
      success: true,
      alreadyProcessed: true,
      transaction,
      booking,
    };
  }

  // 3. Atomically Lock Transaction (pending/processing -> processing)
  const lockedTransaction = await Transaction.findOneAndUpdate(
    {
      _id: transaction._id,
      payment_status: { $in: ["pending", "processing"] },
    },
    {
      $set: {
        payment_status: "processing",
        ...(transactionId ? { transaction_id: transactionId } : {}),
      },
    },
    { new: true }
  );

  if (!lockedTransaction) {
    // Check if another concurrent thread finalized it
    const refreshed = await Transaction.findById(transaction._id);
    if (refreshed?.payment_status === "successful") {
      const booking = refreshed.booking ? await bookingModel.findById(refreshed.booking) : null;
      return {
        success: true,
        alreadyProcessed: true,
        transaction: refreshed,
        booking,
      };
    }
    return {
      success: false,
      code: "LOCK_FAILED",
      message: "Transaction is currently being processed by another worker",
    };
  }

  transaction = lockedTransaction;

  try {
    // 4. Verify with Flutterwave API
    const verifiedPayment = await verifyFlutterwavePayment(
      transactionId || transaction.transaction_id,
      txRef || transaction.tx_ref
    );

    if (!verifiedPayment) {
      throw new Error("Unable to verify payment with Flutterwave API");
    }

    if (verifiedPayment.status !== "successful") {
      transaction.payment_status = "failed";
      transaction.status = "failed";
      await transaction.save();
      return {
        success: false,
        code: "PAYMENT_NOT_SUCCESSFUL",
        message: `Payment status from Flutterwave is '${verifiedPayment.status}'`,
        transaction,
      };
    }

    // Verify tx_ref
    if (verifiedPayment.tx_ref !== transaction.tx_ref) {
      throw new Error(`tx_ref mismatch: expected ${transaction.tx_ref}, got ${verifiedPayment.tx_ref}`);
    }

    // Verify currency
    if (verifiedPayment.currency !== transaction.currency) {
      throw new Error(`Currency mismatch: expected ${transaction.currency}, got ${verifiedPayment.currency}`);
    }

    // Verify amount
    const expectedAmount = Number(transaction.gross_amount);
    const paidAmount = Number(verifiedPayment.amount);
    if (Math.abs(expectedAmount - paidAmount) > 0.01) {
      throw new Error(`Amount mismatch: expected ${expectedAmount}, received ${paidAmount}`);
    }

    // 5. Update transaction details
    const rawMethod =
      verifiedPayment.payment_type ||
      verifiedPayment.channel ||
      verifiedPayment.meta?.payment_method;

    transaction.transaction_id = verifiedPayment.id;
    transaction.payment_method = normalizePaymentMethod(rawMethod);
    transaction.bank_name =
      verifiedPayment.bank_name ||
      verifiedPayment.card?.issuer ||
      null;
    transaction.meta = verifiedPayment;

    // 6. CREDIT PAYMENT
    if (transaction.paymentType === "credit") {
      if (transaction.credit_owner_type === "company") {
        await employerModel.findByIdAndUpdate(transaction.credit_owner_id, {
          $inc: { creditBalance: transaction.gross_amount },
        });
      } else {
        await userModel.findByIdAndUpdate(
          transaction.credit_owner_id || transaction.user,
          {
            $inc: {
              digitalWallet: transaction.gross_amount,
              rechargedCredit: transaction.gross_amount,
            },
          }
        );
      }

      transaction.payment_status = "successful";
      transaction.status = "successful";
      await transaction.save();

      // Notifications
      try {
        let targetUser = null;
        const isCompany = transaction.credit_owner_type === "company";
        if (isCompany) {
          if (transaction.user_email) {
            targetUser = await userModel.findOne({ email: transaction.user_email });
          }
          if (!targetUser && transaction.credit_owner_id) {
            const company = await employerModel.findById(transaction.credit_owner_id);
            if (company && Array.isArray(company.user) && company.user.length > 0) {
              targetUser = await userModel.findById(company.user[0]);
            }
          }
        } else {
          const targetUserId = transaction.credit_owner_id || transaction.user;
          if (targetUserId) {
            targetUser = await userModel.findById(targetUserId);
          }
        }

        if (targetUser) {
          const title = "Credit Purchase Successful";
          const message = isCompany
            ? `Your company credit recharge of ₦${transaction.gross_amount} was successful.`
            : `Your credit purchase of ₦${transaction.gross_amount} was successful. Your wallet balance has been updated.`;

          if (targetUser.enabledPushNotification !== false) {
            await sendNotificationByFcmToken(targetUser._id, title, message, undefined, "credit");
          }

          const notif = await addNotificationService({
            targetUser: targetUser._id,
            title,
            message,
            type: "credit",
          });

          if (global.io) {
            global.io.emit(`get notification::${targetUser._id}`, { status: 200, message: title, data: notif });
            global.io.emit("get notification", { status: 200, message: "New notification available", data: notif });
          }

          if (targetUser.email) {
            await sendTransactionEmail({
              email: targetUser.email,
              fullName: targetUser.fullName,
              transactionType: "Wallet Credit Purchase",
              amount: transaction.gross_amount,
              currency: transaction.currency || "NGN",
              paymentMethod: transaction.payment_method || "card",
              paymentStatus: "successful",
              txRef: transaction.tx_ref,
              transactionId: transaction.transaction_id,
              date: transaction.createdAt || new Date(),
              description: `Your wallet credit purchase of ₦${transaction.gross_amount} was successful. ${transaction.gross_amount} credits added to your wallet balance.`,
            }).catch((e) => console.error("Credit purchase email error:", e.message));
          }
        }
      } catch (creditNotifErr) {
        console.error("Credit notification error:", creditNotifErr.message);
      }

      return {
        success: true,
        transaction,
        type: "credit",
      };
    }

    // 7. TIP PAYMENT
    if (transaction.paymentType === "tip") {
      await userModel.findByIdAndUpdate(transaction.partner, {
        $inc: { digitalWallet: transaction.net_amount },
      });

      if (transaction.booking) {
        await bookingModel.findByIdAndUpdate(transaction.booking, {
          $inc: { tips: transaction.net_amount },
        });
      }

      transaction.payment_status = "successful";
      transaction.status = "successful";
      transaction.payout_status = "pending";
      await transaction.save();

      await updatePayoutCycle(transaction);

      // Tip notifications
      try {
        const sender = await userModel.findById(transaction.user);
        const partnerUser = await userModel.findById(transaction.partner);
        const tipAmount = transaction.net_amount || transaction.gross_amount;
        const senderName = sender?.fullName || "A customer";
        const partnerName = partnerUser?.fullName || "the provider";

        if (partnerUser) {
          const partnerTitle = "Tip Received";
          const partnerMessage = `${senderName} sent you a tip of ₦${tipAmount}.`;

          if (partnerUser.enabledPushNotification !== false) {
            await sendNotificationByFcmToken(
              partnerUser._id,
              partnerTitle,
              partnerMessage,
              transaction.booking,
              "tip"
            );
          }

          const partnerNotif = await addNotificationService({
            sender: transaction.user || undefined,
            targetUser: partnerUser._id,
            title: partnerTitle,
            message: partnerMessage,
            type: "tip",
            bookingId: transaction.booking || undefined,
          });

          if (global.io) {
            global.io.emit(`get notification::${partnerUser._id}`, { status: 200, message: partnerTitle, data: partnerNotif });
            global.io.emit("get notification", { status: 200, message: "New notification available", data: partnerNotif });
          }

          if (partnerUser.email) {
            await sendTransactionEmail({
              email: partnerUser.email,
              fullName: partnerName,
              transactionType: "Tip Received",
              amount: tipAmount,
              currency: transaction.currency || "NGN",
              paymentMethod: "wallet",
              paymentStatus: "successful",
              txRef: transaction.tx_ref,
              transactionId: transaction.transaction_id,
              bookingId: transaction.booking || undefined,
              date: transaction.createdAt || new Date(),
              description: `You have received a tip of ₦${tipAmount} from a client. The funds have been credited to your wallet balance.`,
            }).catch((e) => console.error("Partner tip email error:", e.message));
          }
        }

        if (sender) {
          const senderTitle = "Tip Sent Successfully";
          const senderMessage = `Your tip of ₦${transaction.gross_amount} to ${partnerName} was successful.`;

          if (sender.enabledPushNotification !== false) {
            await sendNotificationByFcmToken(
              sender._id,
              senderTitle,
              senderMessage,
              transaction.booking,
              "tip"
            );
          }

          const senderNotif = await addNotificationService({
            sender: transaction.partner || undefined,
            targetUser: sender._id,
            title: senderTitle,
            message: senderMessage,
            type: "tip",
            bookingId: transaction.booking || undefined,
          });

          if (global.io) {
            global.io.emit(`get notification::${sender._id}`, { status: 200, message: senderTitle, data: senderNotif });
          }

          if (sender.email) {
            await sendTransactionEmail({
              email: sender.email,
              fullName: sender.fullName,
              transactionType: "Tip Payment",
              amount: transaction.gross_amount,
              currency: transaction.currency || "NGN",
              paymentMethod: transaction.payment_method || "card",
              paymentStatus: "successful",
              txRef: transaction.tx_ref,
              transactionId: transaction.transaction_id,
              providerName: partnerName,
              bookingId: transaction.booking || undefined,
              date: transaction.createdAt || new Date(),
              description: `Your tip of ₦${transaction.gross_amount} to ${partnerName} has been processed successfully.`,
            }).catch((e) => console.error("Sender tip email error:", e.message));
          }
        }
      } catch (tipNotifErr) {
        console.error("Tip notification error:", tipNotifErr.message);
      }

      return {
        success: true,
        transaction,
        type: "tip",
      };
    }

    // 8. BOOKING PAYMENT
    if (transaction.booking_data || transaction.paymentType === "booking") {
      const data = transaction.booking_data;
      if (!data) {
        throw new Error("Missing booking data on transaction");
      }

      const serviceData = await serviceModel.findById(data.service);
      if (!serviceData) {
        throw new Error("Service not found for booking");
      }

      let booking = await bookingModel.findOne({ transaction: transaction._id });

      if (!booking) {
        const sessions = serviceData?.pass?.noOfSessions || 1;
        const validity = serviceData?.pass?.validity || 1;

        const bookingPayload = {
          ...data,
          transaction: transaction._id,
          paymentStatus: "paid",
          status: data.status || "pending",
          paymentMethod: transaction.payment_method || data.paymentMethod || "card",
          bookingRequestExpireAt: data.bookingRequestExpireAt
            ? new Date(data.bookingRequestExpireAt)
            : calculateBookingRequestExpireAt(data),
          expiryReminderSent: Boolean(data.expiryReminderSent),
        };

        const appointmentBase = getAppointmentStartTime(data) || (data.date ? new Date(data.date) : new Date());
        const baseTime = !isNaN(appointmentBase.getTime()) ? appointmentBase.getTime() : Date.now();

        if (data.isOneTime) {
          bookingPayload.sessionLeft = 1;
          bookingPayload.expireDate = new Date(baseTime + 86400000);
        } else {
          bookingPayload.sessionLeft = sessions;
          bookingPayload.expireDate = new Date(baseTime + validity * 86400000);
        }

        try {
          booking = await bookingModel.create(bookingPayload);
        } catch (bookingError) {
          if (bookingError.code === 11000) {
            booking = await bookingModel.findOne({ transaction: transaction._id });
          } else {
            throw bookingError;
          }
        }
      }

      transaction.booking = booking._id;
      transaction.payment_status = "successful";
      transaction.status = "successful";
      transaction.payout_status = "pending";
      await transaction.save();

      await updatePayoutCycle(transaction);

      // Send Push, In-App, and Email notifications to BOTH user and provider
      if (booking) {
        await sendNewBookingNotifications(booking);
      }

      return {
        success: true,
        transaction,
        booking,
        type: "booking",
      };
    }

    throw new Error(`Unknown payment type: ${transaction.paymentType}`);
  } catch (error) {
    console.error("Payment processing error:", error.message);
    if (transaction?._id) {
      await Transaction.findByIdAndUpdate(transaction._id, {
        $set: { payment_status: "pending" },
      });
    }
    throw error;
  }
};

// =====================================================
// RENDER RESPONSIVE HTML PAGE FOR BROWSER REDIRECTS
// =====================================================
const renderPaymentPage = ({
  success = true,
  title = "Payment Successful",
  message = "Your payment has been received and processed.",
  txRef = "",
  transactionId = "",
  amount,
  currency = "NGN",
  paymentMethod = "Card",
  booking = null,
}) => {
  const isSuccess = Boolean(success);
  const statusColor = isSuccess ? "#059669" : "#dc2626";
  const statusBg = isSuccess ? "#ecfdf5" : "#fef2f2";
  const statusBorder = isSuccess ? "#a7f3d0" : "#fecaca";

  const pinDisplay = booking?.pin
    ? `
      <div style="margin: 22px 0 16px 0; padding: 16px; background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; text-align: center;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #166534; margin-bottom: 6px;">
          Your Check-in PIN / Verification OTP
        </div>
        <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #15803d; font-family: 'Courier New', monospace;">
          ${booking.pin}
        </div>
        <div style="font-size: 12px; color: #166534; margin-top: 6px;">
          Share this PIN with your service provider when they arrive to begin your session.
        </div>
      </div>
    `
    : "";

  const bookingDetails = booking
    ? `
      <div style="margin-top: 16px; padding: 14px 18px; background: #f8fafc; border-radius: 10px; font-size: 13px; color: #475569; text-align: left;">
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="color: #64748b;">Booking ID:</span>
          <span style="font-weight: 600; color: #0f172a; font-family: monospace;">${booking._id}</span>
        </div>
        ${booking.date ? `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="color: #64748b;">Date:</span>
          <span style="font-weight: 600; color: #0f172a;">${new Date(booking.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>` : ""}
        ${booking.startTime && booking.endTime ? `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="color: #64748b;">Time:</span>
          <span style="font-weight: 600; color: #0f172a;">${booking.startTime} - ${booking.endTime}</span>
        </div>` : ""}
        ${amount ? `
        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
          <span style="color: #64748b;">Amount Paid:</span>
          <span style="font-weight: 700; color: #059669;">₦${Number(amount).toLocaleString()}</span>
        </div>` : ""}
      </div>
    `
    : amount
    ? `
      <div style="margin-top: 16px; padding: 14px 18px; background: #f8fafc; border-radius: 10px; font-size: 13px; color: #475569; text-align: left;">
        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
          <span style="color: #64748b;">Amount:</span>
          <span style="font-weight: 700; color: #059669;">₦${Number(amount).toLocaleString()}</span>
        </div>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Aura Vive</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.08);
      max-width: 480px;
      width: 100%;
      padding: 36px 28px;
      text-align: center;
    }
    .badge-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: ${statusBg};
      border: 2px solid ${statusBorder};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px auto;
    }
    .badge-icon svg {
      width: 38px;
      height: 38px;
      stroke: ${statusColor};
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 8px;
    }
    p.subtitle {
      font-size: 14px;
      color: #64748b;
      line-height: 1.5;
      margin-bottom: 18px;
    }
    .ref-box {
      background: #f1f5f9;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 12px;
      color: #475569;
      word-break: break-all;
      margin: 14px 0;
      font-family: monospace;
    }
    .btn {
      display: inline-block;
      margin-top: 22px;
      padding: 14px 28px;
      background: ${isSuccess ? "#059669" : "#334155"};
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      border-radius: 12px;
      transition: opacity 0.2s;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .brand-logo {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #0f172a;
      margin-bottom: 24px;
      text-transform: uppercase;
    }
    .brand-logo span {
      color: #059669;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-logo">Aura <span>Vive</span></div>
    <div class="badge-icon">
      ${isSuccess ? `
        <svg fill="none" stroke-width="2.5" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ` : `
        <svg fill="none" stroke-width="2.5" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      `}
    </div>
    <h1>${title}</h1>
    <p class="subtitle">${message}</p>
    ${pinDisplay}
    ${bookingDetails}
    ${txRef ? `<div class="ref-box">Ref: ${txRef}</div>` : ""}
    <a href="https://auravive.ng" class="btn">Return to Aura Vive</a>
  </div>
</body>
</html>`;
};

// =====================================================
// HELPER: CLIENT CONTENT NEGOTIATION
// =====================================================
const wantsJson = (req) => {
  if (req.query?.format === "json") return true;
  if (req.xhr) return true;
  const accept = req.headers?.accept || "";
  if (accept.includes("application/json") && !accept.includes("text/html")) return true;
  return false;
};

// =====================================================
// BROWSER REDIRECT / CALLBACK HANDLER (GET)
// Handles:
// - GET /api/v1/webhook/flutterwave
// - GET /api/v1/transaction/success
// =====================================================
const flutterwaveCallback = async (req, res) => {
  console.log("Flutterwave callback / redirect hit:", {
    method: req.method,
    url: req.originalUrl,
    query: req.query,
  });

  const { status: paymentStatus, tx_ref: txRef, transaction_id: transactionId } = req.query;

  // 1. If user cancelled checkout
  if (paymentStatus === "cancelled") {
    if (wantsJson(req)) {
      return res.status(200).json({
        status: "cancelled",
        statusCode: 200,
        message: "Payment was cancelled by the user",
        data: { tx_ref: txRef, transaction_id: transactionId },
      });
    }
    return res.status(200).send(
      renderPaymentPage({
        success: false,
        title: "Payment Cancelled",
        message: "You cancelled the payment process. No charges were made.",
        txRef,
        transactionId,
      })
    );
  }

  // 2. Process / verify payment
  try {
    const result = await executePaymentProcessing({
      transactionId,
      txRef,
    });

    if (!result.success) {
      if (wantsJson(req)) {
        return res.status(400).json({
          status: "fail",
          statusCode: 400,
          message: result.message || "Payment verification failed",
          data: result,
        });
      }
      return res.status(400).send(
        renderPaymentPage({
          success: false,
          title: "Payment Verification Failed",
          message: result.message || "We were unable to verify your payment. Please contact support.",
          txRef,
          transactionId,
        })
      );
    }

    const { transaction, booking } = result;

    if (wantsJson(req)) {
      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "Payment processed successfully",
        data: {
          transactionId: transaction?.transaction_id || transactionId,
          tx_ref: transaction?.tx_ref || txRef,
          paymentStatus: transaction?.payment_status,
          amount: transaction?.gross_amount,
          currency: transaction?.currency || "NGN",
          bookingId: booking?._id,
          pin: booking?.pin,
        },
      });
    }

    return res.status(200).send(
      renderPaymentPage({
        success: true,
        title: "Payment Successful!",
        message: "Your payment has been received and your booking is confirmed.",
        txRef: transaction?.tx_ref || txRef,
        transactionId: transaction?.transaction_id || transactionId,
        amount: transaction?.gross_amount,
        currency: transaction?.currency || "NGN",
        paymentMethod: transaction?.payment_method,
        booking,
      })
    );
  } catch (error) {
    console.error("Flutterwave callback error:", error);
    if (wantsJson(req)) {
      return res.status(500).json({
        status: "error",
        statusCode: 500,
        message: error.message || "An unexpected error occurred while processing payment",
      });
    }
    return res.status(500).send(
      renderPaymentPage({
        success: false,
        title: "Payment Processing Error",
        message: "An error occurred while confirming your payment. If funds were debited, your transaction will be credited automatically via webhook.",
        txRef,
        transactionId,
      })
    );
  }
};

// =====================================================
// WEBHOOK HANDLER (POST)
// Handles: POST /api/v1/webhook/flutterwave
// =====================================================
const flutterwaveWebhook = async (req, res) => {
  console.log("Flutterwave webhook received");

  try {
    const webhookHash = req.headers["verif-hash"];

    if (!webhookHash || webhookHash !== process.env.FLW_SECRET_HASH) {
      console.error("Invalid Flutterwave webhook hash");
      return res.status(401).end();
    }

    const payload = req.body;

    if (!payload || !payload.data) {
      return res.status(400).end();
    }

    if (payload.event !== "charge.completed") {
      return res.status(200).end();
    }

    const payment = payload.data;

    if (!payment.tx_ref || !payment.id) {
      return res.status(400).end();
    }

    if (payment.status !== "successful") {
      return res.status(200).end();
    }

    await executePaymentProcessing({
      transactionId: payment.id,
      txRef: payment.tx_ref,
    });

    return res.status(200).end();
  } catch (error) {
    console.error("Flutterwave webhook error:", error);
    return res.status(500).end();
  }
};

// Attach named exports to function for flexible requiring
flutterwaveWebhook.flutterwaveWebhook = flutterwaveWebhook;
flutterwaveWebhook.flutterwaveCallback = flutterwaveCallback;
flutterwaveWebhook.executePaymentProcessing = executePaymentProcessing;
flutterwaveWebhook.renderPaymentPage = renderPaymentPage;

module.exports = flutterwaveWebhook;
