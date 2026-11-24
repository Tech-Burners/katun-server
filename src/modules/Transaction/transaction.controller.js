const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { default: mongoose } = require("mongoose");
const Transaction = require("./transaction.model");
const catchAsync = require("../../helpers/catchAsync");
const bookingModel = require("../Booking/booking.model");
const { getUserById } = require("../Auth/auth.service");
const userModel = require("../User/user.model");
const partnerModel = require("../Partner/partner.model");
const {
  sendNotificationByFcmToken,
} = require("../../helpers/sendNotificationByFcmToken");

const { bookingService } =
  require("../Booking/booking.service");
const {
  calculateBookingRequestExpireAt,
  adjustPayoutCycleOnRefund,
  sendNewBookingNotifications,
} = require("../Booking/bookingExpiry.service");

const { default: status } =
  require("http-status");
const { checkSlotAvailability } =
  require("../Availability/availability.service");

const response =
  require("../../helpers/response");
const serviceModel =
  require("../Service/service.model");
const commissionModel =
  require("../Commission/commission.model");
const {
  executePaymentProcessing,
} = require("../../helpers/flutterWaveWebhook");
const { calculateBookingPricing } = require("../../helpers/bookingPricing");

const generate4DigitPin =
  require("../../helpers/generatepin");

const {
  addNotificationService,
} = require("../Notification/notification.service");

const {
  getOrCreateCycle,
} = require("../Payout/payout.service");

const payoutCycleModel =
  require("../Payout/payoutCycle.model");

const {
  emailWithNodemailer,
} = require("../../helpers/email");


const { getAllTransactions, getPendingPayoutService, getcompletePayoutService,
  payoutStatusUpdateService,
  getPartnerMonthlySummaryService, comnpletePayoutService, holdPayoutService,
  getPartnerMonthlyCompletedPayoutService, getAllPayoutService,
  getPlatformEarningTransactionsService, allPayoutOfAPartnerService,
  getAllRefundData, withdrawCreditService } = require("./transaction.service");
const employerModel = require("../Employer/employer.model");
// const { default: mongoose } = require("mongoose");




const generateTxRef = () => {
  return `txn_${Date.now()}_${crypto.randomUUID()}`;
};

const sanitizePaymentLink = (link, req) => {
  if (!link || typeof link !== "string") return link;
  // If it's a test/sandbox dev link that gets blocked or rejected on live checkout
  if (link.includes("dev-flutterwave.com")) {
    const token = link.split("/").filter(Boolean).pop();
    let baseUrl = process.env.BACKEND_URL;
    if (!baseUrl && req) {
      const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
      baseUrl = `${proto}://${req.get("host")}`;
    }
    baseUrl = (baseUrl || "https://api.auravive.ng").replace(/\/+$/, "");
    return `${baseUrl}/api/v1/transaction/pay/${token}`;
  }
  return link;
};

const renderSandboxCheckout = async (req, res) => {
  const { token } = req.params;
  if (!token) {
    return res.status(400).send("Invalid checkout token");
  }

  try {
    const flwRes = await axios.get(
      `https://ravesandboxapi.flutterwave.com/flwv3-pug/getpaidx/api/hosted_pay/${encodeURIComponent(token)}?json=1`,
      { timeout: 15000 }
    );
    const config = flwRes.data;
    if (!config || config.status === "error") {
      return res.status(404).send("This payment session has expired or is invalid.");
    }

    const publicKey = config.public_key || config.PBFPubKey;
    const redirectUrl = config.redirect_url || (process.env.FLW_SUCCESS_URL || "https://api.auravive.ng/api/v1/transaction/success");
    const configTxRef = config.tx_ref || config.txRef;
    const transaction = configTxRef
      ? await Transaction.findOne({ tx_ref: configTxRef }).lean()
      : null;
    const paymentOptions =
      transaction?.payment_method ||
      config.payment_options ||
      config.paymentOptions ||
      "card";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Flutterwave Checkout</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://checkout.flutterwave.com/v3.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f1f5f9;
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: #0f172a;
    }
    .box {
      background: #ffffff;
      padding: 36px 28px;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 420px;
      width: 90%;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: #fef3c7;
      color: #92400e;
      font-size: 12px;
      font-weight: 600;
      border-radius: 9999px;
      margin-bottom: 16px;
    }
    .amount {
      font-size: 28px;
      font-weight: 700;
      margin: 8px 0 20px;
      color: #0f172a;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 4px solid #e2e8f0;
      border-top-color: #f5a623;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn {
      display: block;
      width: 100%;
      margin-top: 20px;
      padding: 14px 20px;
      background: #f5a623;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover { background: #d97706; }
    .note { color: #64748b; font-size: 13px; margin-top: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="badge">SANDBOX TEST MODE</div>
    <div class="spinner" id="spinner"></div>
    <div class="amount">${config.currency || "NGN"} ${Number(config.amount || 0).toLocaleString()}</div>
    <p style="margin: 0; color: #475569; font-size: 14px;">Opening Flutterwave Checkout...</p>
    <button class="btn" id="payBtn" onclick="launchCheckout()">Click Here to Pay</button>
    <div class="note">A Flutterwave secure payment modal will open.</div>
  </div>
  <script>
    var checkoutConfig = {
      public_key: "${publicKey}",
      tx_ref: "${config.tx_ref}",
      amount: ${config.amount},
      currency: "${config.currency || 'NGN'}",
      payment_options: ${JSON.stringify(paymentOptions)},
      customer: ${JSON.stringify(config.customer || {})},
      meta: ${JSON.stringify(config.meta || {})},
      callback: function(res) {
        var redUrl = "${redirectUrl}";
        var sep = redUrl.indexOf("?") === -1 ? "?" : "&";
        var dest = redUrl + sep +
          "status=" + encodeURIComponent(res.status || "successful") +
          "&tx_ref=" + encodeURIComponent(res.tx_ref || "${config.tx_ref}") +
          "&transaction_id=" + encodeURIComponent(res.transaction_id || res.id || "");
        window.location.href = dest;
      },
      onclose: function() {
        var spinner = document.getElementById("spinner");
        if (spinner) spinner.style.display = "none";
      }
    };

    function launchCheckout() {
      if (typeof FlutterwaveCheckout === "function") {
        FlutterwaveCheckout(checkoutConfig);
      } else {
        alert("Payment gateway is loading. Please wait a moment and click again.");
      }
    }

    window.addEventListener("load", function() {
      setTimeout(launchCheckout, 400);
    });
  </script>
</body>
</html>`;

    return res.status(200).send(html);
  } catch (err) {
    console.error("Sandbox checkout rendering error:", err.message);
    return res.status(500).send("Unable to load checkout session. Please try again.");
  }
};


const bookController = catchAsync(
  async (req, res) => {

    const {
      service,
      partner,
      date,
      startTime,
      endTime,
      isOneTime,
      servicePrice,
      totalPrice,
      addons,
      paymentMethod,
    } = req.body;


    const userId = req.User._id;


    // =====================================================
    // VALIDATION & LOOKUPS
    // =====================================================

    if (!service || !partner) {
      return res.status(400).json({
        message:
          "Service and partner are required",
      });
    }

    const serviceDoc = await serviceModel.findById(service);
    if (!serviceDoc) {
      return res.status(404).json({
        message: "Service not found",
      });
    }

    const allowedPaymentMethods = [
      "card",
      "banktransfer",
      "ussd",
      "wallet",
      "cash",
    ];

    if (
      !allowedPaymentMethods.includes(
        paymentMethod
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid payment method",
      });
    }

    if (startTime && endTime) {
      await checkSlotAvailability(service, startTime, endTime);
    }

    const partnerDetails =
      await partnerModel.findOne({
        user: partner,
      });

    const isAutoApproved =
      Boolean(
        partnerDetails?.serviceAutoApproved
      );

    const categoryCommission = serviceDoc?.category
      ? await commissionModel.findOne({ category: serviceDoc.category })
      : null;

    // Server calculates all pricing from its own data (never trusting app-sent totalPrice)
    const pricing = await calculateBookingPricing({
      serviceDoc,
      isOneTime,
      pass: req.body.pass || serviceDoc?.pass,
      addons,
      promoDiscount: req.body.promoDiscount || req.body.discount,
      promoCode: req.body.promoCode || req.body.couponCode,
      partnerDoc: partnerDetails,
      commissionDoc: categoryCommission,
      fallbackServicePrice: servicePrice,
    });

    const grossAmount = pricing.totalPrice;

    if (
      !Number.isFinite(grossAmount) ||
      grossAmount <= 0
    ) {
      return res.status(400).json({
        message:
          "Invalid payment amount",
      });
    }

    const bookingRequestExpireAt = calculateBookingRequestExpireAt(req.body);

    // =====================================================
    // CASH PAYMENT
    // =====================================================

    if (
      paymentMethod === "cash"
    ) {

      const bookingData = {
        user: userId,
        service,
        provider: partner,
        date,
        startTime,
        endTime,
        isOneTime: Boolean(isOneTime),
        pass: !isOneTime ? (req.body.pass || serviceDoc?.pass) : undefined,
        servicePrice: pricing.servicePrice,
        addonsTotal: pricing.addonsTotal,
        promoDiscount: pricing.promoDiscount,
        promoCode: req.body.promoCode || req.body.couponCode,
        subtotal: pricing.subtotal,
        platformFee: pricing.platformFee,
        platformFeePercent: pricing.platformFeePercent,
        partnerCommission: pricing.partnerCommission,
        partnerCommissionPercent: pricing.partnerCommissionPercent,
        totalPrice: pricing.totalPrice,
        addons,
        paymentMethod,
        bookingRequestExpireAt,
        expiryReminderSent: false,
        status:
          isAutoApproved
            ? "approved"
            : "pending",
      };


      const booking =
        await bookingService(
          bookingData
        );


      // Send Push, In-App, and Email notifications to BOTH user and provider
      await sendNewBookingNotifications(booking);


      return res.status(
        status.CREATED
      ).json(
        response({
          status: "success",
          statusCode:
            status.CREATED,
          type: "Booking",
          message:
            "Booking created successfully",
          data: booking,
        })
      );
    }


    // =====================================================
    // WALLET PAYMENT
    // =====================================================

    if (
      paymentMethod === "wallet"
    ) {

      const bookingData = {
        user: userId,
        service,
        provider: partner,
        date,
        startTime,
        endTime,
        isOneTime: Boolean(isOneTime),
        pass: !isOneTime ? (req.body.pass || serviceDoc?.pass) : undefined,
        servicePrice: pricing.servicePrice,
        addonsTotal: pricing.addonsTotal,
        promoDiscount: pricing.promoDiscount,
        promoCode: req.body.promoCode || req.body.couponCode,
        subtotal: pricing.subtotal,
        platformFee: pricing.platformFee,
        platformFeePercent: pricing.platformFeePercent,
        partnerCommission: pricing.partnerCommission,
        partnerCommissionPercent: pricing.partnerCommissionPercent,
        totalPrice: pricing.totalPrice,
        addons,
        paymentMethod,
        bookingRequestExpireAt,
        expiryReminderSent: false,
        status:
          isAutoApproved
            ? "approved"
            : "pending",
      };


      const booking =
        await bookingService(
          bookingData
        );


      // Send Push, In-App, and Email notifications to BOTH user and provider
      await sendNewBookingNotifications(booking);


      return res.status(
        status.CREATED
      ).json(
        response({
          status: "success",
          statusCode:
            status.CREATED,
          type: "Booking",
          message:
            "Booking created successfully",
          data: booking,
        })
      );
    }


    // =====================================================
    // DIGITAL PAYMENT
    // =====================================================

    const user =
      await getUserById(
        userId
      );


    if (!user) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }


    const partnerData =
      await userModel.findById(
        partner
      );


    if (!partnerData) {
      return res.status(404).json({
        message:
          "Partner not found",
      });
    }


    const tx_ref =
      generateTxRef();

    const commission = pricing.partnerCommission;
    const netAmount = pricing.partnerAmount;

    const pin =
      generate4DigitPin();


    const cycleType =
      partnerData.payoutFrequency ===
        "instant"
        ? "weekly"
        : partnerData.payoutFrequency;


    const cycle =
      await getOrCreateCycle(
        partner,
        cycleType
      );


    // =====================================================
    // CREATE PENDING TRANSACTION
    // =====================================================

    const transaction =
      await Transaction.create({

        tx_ref,

        user: userId,

        partner,

        service,

        user_email:
          user.email,

        currency: "NGN",

        gross_amount:
          grossAmount,

        commission,

        net_amount:
          netAmount,

        payout_status:
          "pending",

        payoutCycle:
          cycle?._id,

        payment_method:
          paymentMethod,

        // Payment lifecycle
        payment_status:
          "pending",

        // Keep only if your schema still uses it
        status:
          "pending",

        paymentMethod,

        paymentType:
          "booking",

        booking_data: {

          user: userId,

          service,

          provider: partner,

          date,

          startTime,

          endTime,

          isOneTime: Boolean(isOneTime),

          pass: !isOneTime ? (req.body.pass || serviceDoc?.pass) : undefined,

          servicePrice: pricing.servicePrice,

          addonsTotal: pricing.addonsTotal,

          promoDiscount: pricing.promoDiscount,

          promoCode: req.body.promoCode || req.body.couponCode,

          subtotal: pricing.subtotal,

          platformFee: pricing.platformFee,

          platformFeePercent: pricing.platformFeePercent,

          partnerCommission: pricing.partnerCommission,

          partnerCommissionPercent: pricing.partnerCommissionPercent,

          totalPrice: pricing.totalPrice,

          addons,

          pin,

          paymentMethod,

          bookingRequestExpireAt,

          expiryReminderSent: false,

          status:
            isAutoApproved
              ? "approved"
              : "pending",
        },
      });


    try {

      // =====================================================
      // INITIALIZE FLUTTERWAVE
      // =====================================================

      const paymentResponse =
        await axios.post(

          "https://api.flutterwave.com/v3/payments",

          {
            tx_ref,

            amount:
              grossAmount,

            currency:
              "NGN",

            redirect_url:
              (req.body.redirect_url && !req.body.redirect_url.includes("webhook/flutterwave"))
                ? req.body.redirect_url
                : (process.env.FLW_SUCCESS_URL || "https://api.auravive.ng/api/v1/transaction/success"),

            payment_options:
              paymentMethod,

            customer: {
              email:
                user.email,

              name:
                user.fullName,
            },
          },

          {
            headers: {
              Authorization:
                `Bearer ${process.env.FLW_SECRET_KEY}`,

              "Content-Type":
                "application/json",
            },

            timeout:
              15000,
          }
        );


      const paymentLink = sanitizePaymentLink(
        paymentResponse
          ?.data
          ?.data
          ?.link,
        req
      );


      if (!paymentLink) {
        throw new Error(
          "Flutterwave payment link was not returned"
        );
      }


      return res.json({
        paymentLink,

        tx_ref,
      });

    } catch (error) {

      console.error(
        "Flutterwave initialization error:",
        error.response
          ?.data ||
        error.message
      );


      await Transaction.findByIdAndUpdate(
        transaction._id,
        {
          $set: {
            payment_status:
              "failed",

            status:
              "failed",
          },
        }
      );


      return res.status(502).json({
        message:
          "Unable to initialize payment",
      });
    }
  }
);



const purchaseCreditController =
  catchAsync(async (req, res) => {

    const {
      amount,
      paymentMethod,
    } = req.body;


    const userId =
      req.User._id;


    // =====================================================
    // VALIDATE AMOUNT
    // =====================================================

    const grossAmount =
      Number(amount);


    if (
      !Number.isFinite(
        grossAmount
      ) ||
      grossAmount <= 0
    ) {
      return res.status(400).json({
        message:
          "Invalid credit amount",
      });
    }


    const allowedPaymentMethods = [
      "card",
      "banktransfer",
      "ussd",
    ];


    if (
      !allowedPaymentMethods.includes(
        paymentMethod
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid payment method",
      });
    }


    // =====================================================
    // GET USER
    // =====================================================

    const user =
      await getUserById(
        userId
      );


    if (!user) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }


    // =====================================================
    // HR COMPANY
    // =====================================================

    let idForTrack =
      userId;


    if (
      req.User.role === "hr"
    ) {

      const company =
        await employerModel.findOne({
          user: userId,
        });


      if (!company) {
        return res.status(404).json({
          message:
            "Company not found",
        });
      }


      // IMPORTANT:
      // DO NOT update creditBalance here.
      //
      // Credit is added only after successful
      // Flutterwave webhook processing.

      idForTrack =
        company._id;
    }


    const tx_ref =
      generateTxRef();


    const commissionRate =
      0.10;


    const commission =
      Number(
        (
          grossAmount *
          commissionRate
        ).toFixed(2)
      );


    const netAmount =
      Number(
        (
          grossAmount -
          commission
        ).toFixed(2)
      );


    // =====================================================
    // CREATE PENDING TRANSACTION
    // =====================================================

    const transaction =
      await Transaction.create({

        tx_ref,

        user:
          idForTrack,

        user_email:
          user.email,

        currency:
          "NGN",

        gross_amount:
          grossAmount,

        commission,

        net_amount:
          netAmount,

        payout_status:
          "pending",

        payment_method:
          paymentMethod,

        payment_status:
          "pending",

        status:
          "pending",

        paymentType:
          "credit",

        // Needed by webhook to know whether
        // this is an HR/company credit.
        credit_owner_type:
          req.User.role === "hr"
            ? "company"
            : "user",

        credit_owner_id:
          idForTrack,
      });


    try {

      const paymentResponse =
        await axios.post(

          "https://api.flutterwave.com/v3/payments",

          {
            tx_ref,

            amount:
              grossAmount,

            currency:
              "NGN",

            redirect_url:
              (req.body.redirect_url && !req.body.redirect_url.includes("webhook/flutterwave"))
                ? req.body.redirect_url
                : (process.env.FLW_SUCCESS_URL || "https://api.auravive.ng/api/v1/transaction/success"),

            payment_options:
              paymentMethod,

            customer: {
              email:
                user.email,

              name:
                user.fullName,
            },
          },

          {
            headers: {
              Authorization:
                `Bearer ${process.env.FLW_SECRET_KEY}`,

              "Content-Type":
                "application/json",
            },

            timeout:
              15000,
          }
        );


      const paymentLink = sanitizePaymentLink(
        paymentResponse
          ?.data
          ?.data
          ?.link,
        req
      );


      if (!paymentLink) {
        throw new Error(
          "Flutterwave payment link was not returned"
        );
      }


      return res.json({
        paymentLink,

        tx_ref,
      });

    } catch (error) {

      console.error(
        "Flutterwave credit payment error:",
        error.response
          ?.data ||
        error.message
      );


      await Transaction.findByIdAndUpdate(
        transaction._id,
        {
          $set: {
            payment_status:
              "failed",

            status:
              "failed",
          },
        }
      );


      return res.status(502).json({
        message:
          "Unable to initialize payment",
      });
    }
  });



const tipsController =
  catchAsync(async (req, res) => {

    const {
      providerId,
      amount,
      paymentMethod,
      bookingId,
    } = req.body;


    const userId =
      req.User._id;


    const grossAmount =
      Number(amount);


    if (
      !Number.isFinite(
        grossAmount
      ) ||
      grossAmount <= 0
    ) {
      return res.status(400).json({
        message:
          "Invalid tip amount",
      });
    }


    const user =
      await getUserById(
        userId
      );


    if (!user) {
      return res.status(404).json({
        message:
          "User not found",
      });
    }


    const provider =
      await userModel.findById(
        providerId
      );


    if (!provider) {
      return res.status(404).json({
        message:
          "Partner not found",
      });
    }


    // If booking ID is provided,
    // ensure booking exists.
    let booking = null;


    if (bookingId) {

      booking =
        await bookingModel.findById(
          bookingId
        );


      if (!booking) {
        return res.status(404).json({
          message:
            "Booking not found",
        });
      }


      // Prevent tipping another user's booking
      if (
        String(booking.user) !==
        String(userId)
      ) {
        return res.status(403).json({
          message:
            "You cannot tip on this booking",
        });
      }


      // Ensure the provider matches
      if (
        String(booking.provider) !==
        String(providerId)
      ) {
        return res.status(400).json({
          message:
            "Invalid provider for this booking",
        });
      }
    }


    const tx_ref =
      generateTxRef();


    const commissionRate =
      0.10;


    const commission =
      Number(
        (
          grossAmount *
          commissionRate
        ).toFixed(2)
      );


    const netAmount =
      Number(
        (
          grossAmount -
          commission
        ).toFixed(2)
      );


    const transaction =
      await Transaction.create({

        tx_ref,

        user:
          userId,

        user_email:
          user.email,

        currency:
          "NGN",

        gross_amount:
          grossAmount,

        commission,

        net_amount:
          netAmount,

        payout_status:
          "pending",

        payment_status:
          "pending",

        status:
          "pending",

        paymentType:
          "tip",

        partner:
          providerId,

        booking:
          bookingId || null,

        payment_method:
          paymentMethod,
      });


    try {

      const paymentResponse =
        await axios.post(

          "https://api.flutterwave.com/v3/payments",

          {
            tx_ref,

            amount:
              grossAmount,

            currency:
              "NGN",

            redirect_url:
              (req.body.redirect_url && !req.body.redirect_url.includes("webhook/flutterwave"))
                ? req.body.redirect_url
                : (process.env.FLW_SUCCESS_URL || "https://api.auravive.ng/api/v1/transaction/success"),

            payment_options:
              paymentMethod,

            meta: {
              providerId,
              bookingId,
            },

            customer: {
              email:
                user.email,

              name:
                user.fullName,
            },
          },

          {
            headers: {
              Authorization:
                `Bearer ${process.env.FLW_SECRET_KEY}`,

              "Content-Type":
                "application/json",
            },

            timeout:
              15000,
          }
        );


      const paymentLink = sanitizePaymentLink(
        paymentResponse
          ?.data
          ?.data
          ?.link,
        req
      );


      if (!paymentLink) {
        throw new Error(
          "Flutterwave payment link was not returned"
        );
      }


      return res.json({
        paymentLink,

        tx_ref,
      });

    } catch (error) {

      console.error(
        "Flutterwave tip payment error:",
        error.response
          ?.data ||
        error.message
      );


      await Transaction.findByIdAndUpdate(
        transaction._id,
        {
          $set: {
            payment_status:
              "failed",

            status:
              "failed",
          },
        }
      );


      return res.status(502).json({
        message:
          "Unable to initialize payment",
      });
    }
  });




const verifyPayment = catchAsync(async (req, res) => {
  const transactionId =
    req.query.transaction_id ||
    req.body.transaction_id ||
    req.params.transaction_id ||
    null;
  const txRef =
    req.query.tx_ref ||
    req.body.tx_ref ||
    req.params.tx_ref ||
    null;

  if (!transactionId && !txRef) {
    return res.status(400).json({
      status: "fail",
      message: "tx_ref or transaction_id is required for payment verification",
    });
  }

  const result = await executePaymentProcessing({
    transactionId,
    txRef,
  });

  if (!result.success) {
    return res.status(400).json({
      status: "fail",
      message: result.message || "Payment verification failed",
      data: result,
    });
  }

  const { transaction, booking, alreadyProcessed } = result;

  return res.status(200).json({
    status: "success",
    message: alreadyProcessed
      ? "Payment was already verified and processed"
      : "Payment verified and processed successfully",
    data: {
      transactionId: transaction?.transaction_id || transactionId,
      tx_ref: transaction?.tx_ref || txRef,
      paymentStatus: transaction?.payment_status,
      amount: transaction?.gross_amount,
      currency: transaction?.currency || "NGN",
      bookingId: booking?._id,
      pin: booking?.pin,
      booking,
    },
  });
});
























// const { bookingService } = require("../Booking/booking.service");
// const { default: mongoose } = require("mongoose");
// const employerModel = require("../Employer/employer.model");
// const auditModel = require("../Audit/audit.model");
// const { add } = require("date-fns");
// const { addAuditReport } = require("../Audit/audit.service");
// const { addNotificationService } = require("../Notification/notification.service");
// const { getOrCreateCycle } = require("../Payout/payout.service");
// const payoutCycleModel = require("../Payout/payoutCycle.model");
// const { emailWithNodemailer } = require("../../helpers/email");



// In-memory cache for bank lists: countryCode -> { timestamp, data }
const bankCache = new Map();
const BANK_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

// Preload local seed file for Nigeria (NG) if available for instant responses
try {
  const seedFile = path.join(__dirname, "../../helpers/banks_NG.json");
  if (fs.existsSync(seedFile)) {
    const seedData = JSON.parse(fs.readFileSync(seedFile, "utf8"));
    if (Array.isArray(seedData) && seedData.length > 0) {
      bankCache.set("NG", {
        timestamp: Date.now(),
        data: seedData,
      });
    }
  }
} catch (err) {
  // Silent fallback
}

const getBanks = catchAsync(async (req, res) => {
  const country = (req.params.country || req.query.country || "NG").trim().toUpperCase();
  const search = (req.query.search || req.query.name || req.query.q || "").trim().toLowerCase();
  const sortOrder = (req.query.order || req.query.sort || "asc").trim().toLowerCase();
  const forceRefresh = String(req.query.refresh).toLowerCase() === "true";

  let rawBanks = [];
  const cached = bankCache.get(country);

  if (!forceRefresh && cached && Date.now() - cached.timestamp < BANK_CACHE_TTL_MS) {
    rawBanks = cached.data;
  } else {
    try {
      const response = await axios.get(
        `https://api.flutterwave.com/v3/banks/${country}`,
        {
          headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
          timeout: 25000,
        }
      );

      if (Array.isArray(response.data?.data)) {
        rawBanks = response.data.data.map((b) => ({
          ...b,
          name: typeof b.name === "string" ? b.name.trim() : b.name,
        }));
        bankCache.set(country, {
          timestamp: Date.now(),
          data: rawBanks,
        });
      }
    } catch (err) {
      // Fallback to cached data if network request fails
      if (cached && cached.data) {
        rawBanks = cached.data;
      } else {
        console.error("Flutterwave getBanks error:", err.response?.data || err.message);
        return res.status(502).json({
          status: "error",
          message: "Failed to fetch banks from payment provider. Please try again.",
          data: [],
        });
      }
    }
  }

  // Filter by search term if provided (matches bank name or bank code)
  let result = [...rawBanks];
  if (search) {
    result = result.filter((bank) => {
      const bankName = (bank.name || "").toLowerCase();
      const bankCode = String(bank.code || "").toLowerCase();
      return bankName.includes(search) || bankCode.includes(search);
    });
  }

  // Sort alphabetically by bank name (A-Z by default, or Z-A if order=desc)
  result.sort((a, b) => {
    const nameA = (a.name || "").trim();
    const nameB = (b.name || "").trim();
    return sortOrder === "desc"
      ? nameB.localeCompare(nameA, undefined, { sensitivity: "base" })
      : nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
  });

  return res.json({
    status: "success",
    message: "Banks fetched successfully",
    data: result,
  });
});



// const bookController = catchAsync(async (req, res) => {

//   const {
//     service,
//     partner,
//     date,
//     startTime,
//     endTime,
//     isOneTime,
//     servicePrice,
//     totalPrice,
//     addons,
//     paymentMethod
//   } = req.body;

//   const userId = req.User._id;

//   const partnerDetails = await partnerModel.findOne({ user: partner });
//   const isAutoApproved = Boolean(partnerDetails?.serviceAutoApproved);
//   // console.log({ isAutoApproved, partnerDetails })


//   // Handle Cash and Wallet payments
//   if (paymentMethod === "cash" || paymentMethod === "wallet") {

//     const bookingData = {
//       user: userId,
//       service,
//       provider: partner,
//       date,
//       startTime,
//       endTime,
//       isOneTime,
//       servicePrice,
//       totalPrice,
//       addons,
//       paymentMethod,
//       status: isAutoApproved ? "approved" : "pending"
//     };

//     const booking = await bookingService(bookingData);



//     // REPLACE the existing notification block (cash/wallet section) with this:
//     // console.log({ partnerDetails })
//     if (partnerDetails?.enabledPushNotification === true) {
//       if (isAutoApproved === true) {
//         await sendNotificationByFcmToken(
//           partner,
//           "New Booking",
//           "New Booking schedule",
//           booking._id,
//           "booking"
//         );
//         await addNotificationService({
//           sender: userId,
//           targetUser: partner,
//           title: "New Booking",
//           message: "New Booking schedule",
//           type: "booking",
//           bookingId: booking._id
//         });
//         const userData = await userModel.findById(userId);
//         // console.log({ userData })
//         if (userData && userData.enabledPushNotification) {
//           await sendNotificationByFcmToken(
//             userId,
//             "New Booking",
//             "Booking approved",
//             booking._id,
//             "booking"
//           )
//         };
//         await addNotificationService({
//           sender: partner,
//           targetUser: userId,
//           title: "New Booking",
//           message: "Booking approved",
//           type: "booking",
//           bookingId: booking._id
//         });

//       } else {
//         const partnerData = await userModel.findById(partner);
//         // console.log({ partnerData })
//         if (partnerData?.enabledPushNotification === true) {
//           await sendNotificationByFcmToken(
//             partner,
//             "New Booking",
//             "New Booking waiting for approval",
//             booking._id,
//             "booking"
//           )
//         };
//         await addNotificationService({
//           sender: userId,
//           targetUser: partner,
//           title: "New Booking",
//           message: "New Booking waiting for approval",
//           type: "booking",
//           bookingId: booking._id
//         });
//       }
//     }
//     const partnerEmail = await userModel.findById(partner).select('email');

//     await emailWithNodemailer({
//       // email: "mdnasifurahman@gmail.com",
//       email: partnerEmail.email,
//       subject: "New Booking",
//       html: `You have a new booking from ${req.User.fullName}. Please check your dashboard for details.`,
//     });
//     // console.log(req.User,"==========")
//     await emailWithNodemailer({
//       // email: 'mdnasifurahman@gmail.com',
//       email: req.User.email,
//       subject: "Booking Confirmation",
//       html: `Thank you! Your booking has been successfully created. You can check your dashboard for details. and we will notify you once the partner approve your booking.`,
//     });

//     return res.status(status.CREATED).json(
//       response({
//         status: "success",
//         statusCode: status.CREATED,
//         type: "Booking",
//         message: "Booking created successfully",
//         data: booking
//       })
//     );
//   }

//   // Digital Payment flow - create payment link
//   const user = await getUserById(userId);
//   const tx_ref = `txn_${Date.now()}_${userId}`;

//   const commissionRate = 0.10; // 10%
//   const grossAmount = Number(totalPrice);
//   const commission = grossAmount * commissionRate;
//   const netAmount = grossAmount - commission;

//   const partnerData = await userModel.findById(partner);

//   if (!partnerData) {
//     return res.status(400).json({
//       message: "Partner not found",
//     });
//   }

//   const pin = generate4DigitPin();

//   const userData = await userModel.findById(partner);

//   const cycleType = userData.payoutFrequency === "instant"
//     ? "weekly"
//     : userData.payoutFrequency;

//   const cycle = await getOrCreateCycle(partner, cycleType);

//   const transaction = await Transaction.create({
//     tx_ref,
//     user: userId,
//     partner,
//     service,

//     user_email: user.email,
//     currency: "NGN",

//     gross_amount: grossAmount,
//     commission,
//     net_amount: netAmount,

//     payout_status: "pending",
//     payoutCycle: cycle._id,

//     status: "pending",
//     paymentMethod,
//     paymentType: "booking",

//     booking_data: {
//       user: userId,
//       service,
//       provider: partner,
//       date,
//       startTime,
//       endTime,
//       isOneTime,
//       servicePrice,
//       totalPrice,
//       addons,
//       pin,
//       paymentMethod,
//       status: isAutoApproved ? "approved" : "pending"
//     },
//   });

//   // await payoutCycleModel.findByIdAndUpdate(cycle._id, {
//   //   $push: { transactions: transaction._id },
//   //   $inc: { totalAmount: netAmount }
//   // });

//   await payoutCycleModel.updateOne(
//     { _id: cycle._id },
//     {
//       $addToSet: { transactions: transaction._id },
//       $inc: { totalAmount: netAmount }
//     }
//   );


//   const paymentResponse = await axios.post(
//     "https://api.flutterwave.com/v3/payments",
//     {
//       tx_ref,
//       amount: grossAmount,
//       currency: "NGN",
//       redirect_url: process.env.FLW_SUCCESS_URL,
//       payment_options: paymentMethod,
//       customer: {
//         email: user.email,
//         name: user.fullName,
//       },
//     },
//     {
//       headers: {
//         Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
//       },
//     }
//   );

//   res.json({
//     paymentLink: paymentResponse.data.data.link,
//     tx_ref
//   });
// })





// const purchaseCreditController = catchAsync(async (req, res) => {

//   const {
//     amount,
//     paymentMethod
//   } = req.body;
//   let userId = req.User._id;
//   let idForTrack = req.User._id;
//   let company;
//   if (req.User.role === 'hr') {
//     company = await employerModel.findOne({ user: userId });
//     if (!company) return res.status(404).json({ error: "Company not found" });
//     idForTrack = company._id;
//     company.creditBalance = Number((company.creditBalance || 0) + Number(amount).toFixed(2));
//     await company.save();
//   }
//   const user = await getUserById(userId);

//   const tx_ref = `txn_${Date.now()}_${userId}`;

//   const commissionRate = 0.10; // 10%
//   const grossAmount = Number(amount);
//   const commission = grossAmount * commissionRate;
//   const netAmount = grossAmount - commission;


//   await Transaction.create({
//     tx_ref,
//     user: idForTrack,
//     user_email: user.email,

//     // amount: grossAmount,
//     currency: "NGN",

//     gross_amount: grossAmount,
//     commission,
//     net_amount: netAmount,

//     payout_status: "pending",
//     paymentType: "credit"
//   });

//   const response = await axios.post(
//     "https://api.flutterwave.com/v3/payments",
//     {
//       tx_ref,
//       amount: grossAmount,
//       currency: "NGN",
//       redirect_url: process.env.FLW_SUCCESS_URL,
//       payment_options: paymentMethod,
//       customer: {
//         email: user.email,
//         name: user.fullName,
//       },
//     },
//     {
//       headers: {
//         Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
//       },
//     }
//   );

//   res.json({
//     paymentLink: response.data.data.link,
//     tx_ref,
//   });
// });




// const tipsController = catchAsync(async (req, res) => {
//   const { providerId, amount, paymentMethod, bookingId } = req.body;
//   const userId = req.User._id;

//   const user = await getUserById(userId);

//   const tx_ref = `txn_${Date.now()}_${userId}`;

//   const commissionRate = 0.10;
//   const grossAmount = Number(amount);
//   const commission = grossAmount * commissionRate;
//   const netAmount = grossAmount - commission;

//   await Transaction.create({
//     tx_ref,
//     user: userId,
//     user_email: user.email,
//     currency: "NGN",
//     gross_amount: grossAmount,
//     commission,
//     net_amount: netAmount,
//     payout_status: "pending",
//     paymentType: "tip",
//     partner: providerId,
//     booking: bookingId
//   });

//   const response = await axios.post(
//     "https://api.flutterwave.com/v3/payments",
//     {
//       tx_ref,
//       amount: grossAmount,
//       currency: "NGN",
//       redirect_url: process.env.FLW_SUCCESS_URL,
//       payment_options: paymentMethod,
//       meta: { providerId },
//       customer: {
//         email: user.email,
//         name: user.fullName,
//       },
//     },
//     {
//       headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
//     }
//   );

//   res.json({ paymentLink: response.data.data.link, tx_ref });
// });



const initializePayment = async (req, res) => {
  try {
    const { amount, email, name, paymentMethod = "card" } = req.body;
    const tx_ref = "txn_" + Date.now();

    // Save initial transaction as pending
    await Transaction.create({
      tx_ref,
      user_email: email,
      amount,
      currency: "NGN",
      payment_method: paymentMethod,
      status: "pending",
    });

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref,
        amount,
        currency: "NGN",
        redirect_url: process.env.FLW_SUCCESS_URL || "https://api.auravive.ng/api/v1/transaction/success",
        payment_options: paymentMethod,
        customer: { email, name },
        customizations: {
          title: "My App Payment",
          description: "Subscription payment",
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const paymentLink = sanitizePaymentLink(response?.data?.data?.link, req);
    res.json({
      paymentLink,
      tx_ref,
    });
  } catch (error) {
    console.log("Flutterwave Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
};

// const verifyPayment = async (req, res) => {

//   const { transaction_id } = req.query;

//   if (!transaction_id)
//     return res.send("Transaction missing");

//   const response = await axios.get(
//     `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
//     {
//       headers: {
//         Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
//       },
//     }
//   );

//   const payment = response.data.data;

//   await Transaction.findOneAndUpdate(
//     { tx_ref: payment.tx_ref },
//     {
//       transaction_id: payment.id,
//       status:
//         payment.status === "successful"
//           ? "successful"
//           : "failed",
//     }
//   );

//   res.send("Payment verification complete");
// };


const earningController = catchAsync(async (req, res) => {
  const {
    page,
    limit,
    month,
    year,
    search,
    paymentType,
    role
  } = req.query;

  const result = await getPlatformEarningTransactionsService({
    page,
    limit,
    month,
    year,
    search,
    paymentType,
    role
  });

  return res.status(200).json({
    success: true,
    message: "Platform earnings fetched successfully",
    data: result.result,
    pagination: result.pagination
  });
})




const allTransactionController = catchAsync(async (req, res) => {

  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,

    month: req.query.month ? Number(req.query.month) : undefined,
    year: req.query.year ? Number(req.query.year) : undefined,

    payment_method: req.query.payment_method || undefined,
    search: req.query.search || undefined,
  };

  const transactions = await getAllTransactions(option);

  return res.status(status.OK).json(
    response({
      status: 'success',
      statusCode: status.OK,
      type: "Transaction",
      message: "Transaction fetched successfully",
      data: transactions,
    })
  );
});



const allPayoutOfAPartnerController = catchAsync(async (req, res) => {
  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
  };

  const payoutData = await allPayoutOfAPartnerService(req.User._id, option);
  const wallet = await userModel.findById(req.User._id).select('digitalWallet');

  return res.status(status.OK).json(
    response({
      status: 'success',
      statusCode: status.OK,
      type: "Transaction",
      message: "Transaction fetched successfully",
      data: {
        transactions: payoutData.result,
        pagination: payoutData.pagination,
        wallet: wallet.digitalWallet,
        availableForPayout: payoutData.availableForPayoutBalanceFromLastMonth,
        totalPendingPayout: payoutData.totalPendingPayout
      },
    })
  );
});



const withdrawCreditController = catchAsync(async (req, res) => {
  const result = await withdrawCreditService(req.User._id, req.body.amount)
  return res.status(status.OK).json(
    response({
      status: 'success',
      statusCode: status.OK,
      type: "Transaction",
      message: "withdraw successfully",
      data: result
    })
  );
})





const allPayoutController = catchAsync(async (req, res) => {

  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,

    month: req.query.month ? Number(req.query.month) : undefined,
    year: req.query.year ? Number(req.query.year) : undefined,

    status: req.query.status,
    search: req.query.search,
    payoutType: req.query.payoutType,
  };

  const transactions = await getAllPayoutService(option);

  return res.status(status.OK).json(
    response({
      status: 'success',
      statusCode: status.OK,
      type: "Transaction",
      message: "Transaction fetched successfully",
      data: transactions,
    })
  );
});



const refundController = catchAsync(async (req, res) => {

  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
    month: req.query.month ? Number(req.query.month) : undefined,
    year: req.query.year ? Number(req.query.year) : undefined,
    search: req.query.search || undefined,
  };

  const result = await getAllRefundData(option);

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "Transaction",
      message: "Refund data fetched successfully",
      data: result
    })
  );
});



const partnerMonthlySummaryController = catchAsync(async (req, res) => {

  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,

    month: req.query.month ? Number(req.query.month) : undefined,
    year: req.query.year ? Number(req.query.year) : undefined,

    search: req.query.search,
    payout_status: req.query.status
  };

  const transactions = await getPartnerMonthlySummaryService(option);

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "Transaction",
      message: "Partner monthly summary fetched successfully",
      data: transactions,
    })
  );
});


const holdPayoutController = catchAsync(async (req, res) => {

  const { partnerId, month, year, status } = req.body;

  const result = await holdPayoutService({
    partnerId,
    month,
    year,
    status
  });
  if (!result.modifiedCount) {
    return res.status(400).json(
      response({
        status: "fail",
        message: "No eligible payout found",
      })
    );
  }
  if (result.modifiedCount > 0) {
    const partner = await userModel.findById(partnerId);

    await addAuditReport({
      action: "Payout",
      performedBy: req.User._id,
      summary: `Payout hold for partner ${partner.fullName} for ${month}/${year}`,
    });
  }


  return res.status(200).json(
    response({
      status: "success",
      message: "Monthly payout completed",
      data: result
    })
  );
});



const doCompletePayoutController = catchAsync(async (req, res) => {
  const { partnerId, month, year, status } = req.body;
  const result = await comnpletePayoutService({ partnerId, month, year, status });
  if (!result.modifiedCount) {
    return res.status(400).json(
      response({
        status: "fail",
        message: "No eligible payout found"
      })
    );
  }
  if (result.modifiedCount > 0) {
    const partner = await userModel.findById(partnerId);
    await addAuditReport({
      action: "Payout",
      performedBy: req.User._id,
      summary: `Completed payout for partner ${partner.fullName} for ${month}/${year}`,
    });
  }

  return res.status(200).json(
    response({
      status: "success",
      message: "Monthly payout completed",
      data: result
    })
  );
});



const partnerMonthlyCompletedPayoutController = catchAsync(async (req, res) => {

  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,

    month: req.query.month ? Number(req.query.month) : undefined,
    year: req.query.year ? Number(req.query.year) : undefined,
    search: req.query.search,
    payoutType: req.query.payoutType,
  };

  const transactions = await getPartnerMonthlyCompletedPayoutService(option);

  return res.status(status.OK).json(
    response({
      status: 'success',
      statusCode: status.OK,
      type: "Transaction",
      message: "Partner monthly completed payout fetched successfully",
      data: transactions,
    })
  );
});




const cancelBooking = catchAsync(async (req, res) => {
  const { bookingId } = req.params;
  const { reason, applyCancellationfee = true } = req.body;
  const userId = req.User._id;

  const booking = await bookingModel
    .findById(bookingId)
    .populate("transaction");

  if (!booking)
    return res.status(404).json({ error: "Booking not found" });

  if (booking.status === "completed")
    return res.status(400).json({ error: "Completed booking can't cancel" });

  if (booking.status === "cancelled")
    return res.status(400).json({ error: "Already cancelled" });

  const grossAmount = Number(booking.totalPrice);

  // =====================================
  // WHO CANCELLED
  // =====================================
  const cancelledBy =
    booking.provider?.toString() === userId.toString()
      ? "partner"
      : "user";

  // =====================================
  // TIME DIFFERENCE
  // =====================================
  const now = new Date();
  const startTime = new Date(booking.startTime);
  const diffHours = (startTime - now) / (1000 * 60 * 60);

  const CANCELLATION_FEE = 10;

  let refundPercent = 0;
  let cancellationFee = 0;

  // =====================================
  // PARTNER CANCEL → FULL REFUND OR WITH FEE BASED ON applyCancellationfee
  // =====================================
  if (cancelledBy === "partner") {
    refundPercent = 100;
    cancellationFee = applyCancellationfee ? CANCELLATION_FEE : 0;
  } else {
    // USER CANCELLATION → TIME-BASED REFUND
    cancellationFee = 0;

    if (diffHours >= 48) refundPercent = 100;
    else if (diffHours >= 24) refundPercent = 50;
    else refundPercent = 0;
  }

  // =====================================
  // CALCULATIONS (ON GROSS AMOUNT)
  // =====================================
  const refundableBase = (grossAmount * refundPercent) / 100;

  const refundedAmount = Math.max(
    0,
    Number((refundableBase - cancellationFee).toFixed(2))
  );

  booking.status = "cancelled";
  booking.reason = reason;
  await booking.save();

  // =====================================
  // MARK ORIGINAL TRANSACTION AS REFUNDED
  // =====================================
  const originalTransactionId = booking.transaction?._id || booking.transaction;
  if (originalTransactionId) {
    const updatedOriginalTx = await Transaction.findByIdAndUpdate(
      originalTransactionId,
      {
        payout_status: "refund",
        payment_status: "refunded",
        status: "refunded",
        paymentType: "refund",
        refund_status: "completed",
        refund_at: new Date(),
        refund_reason: reason || "Manual cancellation",
      },
      { new: true }
    );
    if (updatedOriginalTx) {
      await adjustPayoutCycleOnRefund(updatedOriginalTx);
    }
  }

  // =====================================
  // NOT PAID
  // =====================================
  if (booking.paymentStatus !== "paid") {
    booking.paymentStatus = "pending";
    await booking.save();

    return res.json({
      message: "Booking cancelled",
      refundedAmount: 0,
      cancellationFee: 0,
    });
  }

  // =====================================
  // CASH PAYMENT
  // =====================================
  if (booking.paymentMethod === "cash") {
    booking.paymentStatus = "pending";
    await booking.save();

    return res.json({
      message: "Cash booking cancelled",
      refundedAmount: 0,
      cancellationFee: 0,
    });
  }

  // =====================================
  // WALLET PAYMENT
  // =====================================
  if (booking.paymentMethod === "wallet") {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await userModel
        .findById(booking.user)
        .session(session);

      if (!user) throw new Error("User not found");

      // -------- REFUND --------
      if (refundedAmount > 0) {
        user.digitalWallet += refundedAmount;
        await user.save({ session });

        await Transaction.create(
          [{
            tx_ref: `refund_${Date.now()}`,
            user: booking.user,
            service: booking.service,
            booking: booking._id,
            booking_data: booking,
            currency: "NGN",
            gross_amount: refundedAmount,
            commission: 0,
            net_amount: refundedAmount,
            payment_method: "wallet",
            payment_status: "refunded",
            payout_status: "refund",
            paymentType: "refund",
            status: "successful",
            description: `Refund booking ${booking.bookingId}`,
          }],
          { session }
        );
      }

      // -------- CANCELLATION FEE --------
      if (cancellationFee > 0) {
        await Transaction.create(
          [{
            tx_ref: `cancel_${Date.now()}`,
            user: booking.user,
            partner: booking.provider,
            service: booking.service,
            booking: booking._id,
            booking_data: booking,
            currency: "NGN",
            gross_amount: cancellationFee,
            commission: 0, // NOT ADMIN COMMISSION
            net_amount: cancellationFee,
            payment_method: "wallet",
            payment_status: "cancellation-fee",
            payout_status: "pending",
            paymentType: "refund",
            status: "successful",
            description: `Cancellation fee ${booking.bookingId}`,
          }],
          { session }
        );
      }

      booking.paymentStatus =
        refundedAmount > 0 ? "refunded" : "failed";

      await booking.save({ session });

      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  }

  // =====================================
  // DIGITAL PAYMENT
  // =====================================
  if (booking.paymentMethod === "digital-payment") {
    const paymentMethod =
      booking.transaction?.payment_method || "card";

    // REFUND FROM FLUTTERWAVE
    if (
      refundedAmount > 0 &&
      booking.transaction?.transaction_id
    ) {
      try {
        await axios.post(
          `https://api.flutterwave.com/v3/transactions/${booking.transaction.transaction_id}/refund`,
          { amount: refundedAmount },
          {
            headers: {
              Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
            },
          }
        );
      } catch (err) {
        console.error(
          "Refund failed:",
          err.response?.data || err.message
        );
      }
    }

    const transactions = [];

    if (refundedAmount > 0) {
      transactions.push({
        tx_ref: `refund_${Date.now()}`,
        user: booking.user,
        service: booking.service,
        booking: booking._id,
        booking_data: booking,
        currency: "NGN",
        gross_amount: refundedAmount,
        commission: 0,
        net_amount: refundedAmount,
        payment_method: paymentMethod,
        payment_status: "refunded",
        payout_status: "refund",
        paymentType: "refund",
        status: "successful",
        description: `Refund ${booking.bookingId}`,
      });
    }

    if (cancellationFee > 0) {
      transactions.push({
        tx_ref: `cancel_${Date.now()}`,
        user: booking.user,
        partner: booking.provider,
        service: booking.service,
        booking: booking._id,
        booking_data: booking,
        currency: "NGN",
        gross_amount: cancellationFee,
        commission: 0,
        net_amount: cancellationFee,
        payment_method: paymentMethod,
        payment_status: "cancellation-fee",
        payout_status: "pending",
        paymentType: "refund",
        status: "successful",
        description: `Cancellation fee ${booking.bookingId}`,
      });
    }

    if (transactions.length)
      await Transaction.insertMany(transactions);

    booking.paymentStatus =
      refundedAmount > 0 ? "refunded" : "failed";

    await booking.save();
  }
  if (cancelledBy === "partner") {
    const receiverData = await userModel.findById(booking.user);
    const title = "Booking Cancelled";
    const message = "Your booking has been cancelled by the provider.";

    if (receiverData?.enabledPushNotification !== false) {
      await sendNotificationByFcmToken(
        booking.user,
        title,
        message,
        booking._id,
        'booking'
      );
    }

    await addNotificationService({
      sender: booking.provider,
      targetUser: booking.user,
      title,
      message,
      type: "booking",
      bookingId: booking._id,
    });

    if (receiverData?.email) {
      if (refundedAmount > 0) {
        await sendTransactionEmail({
          email: receiverData.email,
          fullName: receiverData.fullName,
          transactionType: "Booking Refund",
          amount: refundedAmount,
          currency: "NGN",
          paymentMethod: booking.paymentMethod || "wallet",
          paymentStatus: "refunded",
          bookingId: booking.bookingId || booking._id,
          txRef: `refund_${booking.bookingId || booking._id}`,
          date: new Date(),
          description: `Your booking was cancelled by the provider. A refund of ₦${refundedAmount} has been processed to your account.`,
        }).catch((e) => console.error("Cancellation refund email error:", e.message));
      } else {
        await emailWithNodemailer({
          email: receiverData.email,
          subject: title,
          html: `<p>Hello ${receiverData.fullName || "Valued Customer"},</p><p>${message}</p>`,
        }).catch((e) => console.error("Cancellation email error:", e.message));
      }
    }
  } else if (cancelledBy === "user") {
    const providerData = await userModel.findById(booking.provider);
    const title = "Booking Cancelled";
    const message = "A booking has been cancelled by the customer.";

    if (providerData?.enabledPushNotification !== false) {
      await sendNotificationByFcmToken(
        booking.provider,
        title,
        message,
        booking._id,
        'booking'
      );
    }

    await addNotificationService({
      sender: booking.user,
      targetUser: booking.provider,
      title,
      message,
      type: "booking",
      bookingId: booking._id,
    });

    if (providerData?.email) {
      await emailWithNodemailer({
        email: providerData.email,
        subject: title,
        html: `<p>Hello ${providerData.fullName || "Partner"},</p><p>${message}</p>`,
      }).catch((e) => console.error("Cancellation email error:", e.message));
    }

    if (refundedAmount > 0) {
      const customerData = await userModel.findById(booking.user);
      if (customerData?.email) {
        await sendTransactionEmail({
          email: customerData.email,
          fullName: customerData.fullName,
          transactionType: "Booking Refund",
          amount: refundedAmount,
          currency: "NGN",
          paymentMethod: booking.paymentMethod || "wallet",
          paymentStatus: "refunded",
          bookingId: booking.bookingId || booking._id,
          txRef: `refund_${booking.bookingId || booking._id}`,
          date: new Date(),
          description: `Your booking was cancelled. A refund of ₦${refundedAmount} has been processed to your account.`,
        }).catch((e) => console.error("User cancellation refund email error:", e.message));
      }
    }
  }

  // =====================================
  res.json({
    message: "Booking cancelled successfully",
    cancelledBy,
    grossAmount,
    refundPercent,
    refundedAmount,
    cancellationFee,
  });
});



/**
 * Send / Resend Transaction Details Email Receipt
 */
const sendTransactionEmailController = catchAsync(async (req, res) => {
  const identifier = req.params.transactionId || req.body.transactionId || req.body.tx_ref;

  if (!identifier) {
    return res.status(status.BAD_REQUEST).json(
      response({
        status: "Error",
        statusCode: status.BAD_REQUEST,
        message: "Transaction ID or tx_ref is required",
      })
    );
  }

  let transaction = null;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    transaction = await Transaction.findById(identifier).populate("user partner service booking");
  }
  if (!transaction) {
    transaction = await Transaction.findOne({
      $or: [{ tx_ref: identifier }, { transaction_id: identifier }],
    }).populate("user partner service booking");
  }

  if (!transaction) {
    return res.status(status.NOT_FOUND).json(
      response({
        status: "Error",
        statusCode: status.NOT_FOUND,
        message: "Transaction not found",
      })
    );
  }

  // Authorization check (admins can access any; users/partners can only access their own)
  const userRole = req.User?.role;
  const currentUserId = req.User?._id?.toString();
  if (currentUserId && !["admin", "sub_admin"].includes(userRole)) {
    const txUserId = transaction.user?._id ? transaction.user._id.toString() : transaction.user?.toString();
    const txPartnerId = transaction.partner?._id ? transaction.partner._id.toString() : transaction.partner?.toString();
    if (txUserId !== currentUserId && txPartnerId !== currentUserId) {
      return res.status(status.FORBIDDEN).json(
        response({
          status: "Error",
          statusCode: status.FORBIDDEN,
          message: "You are not authorized to view or send receipts for this transaction",
        })
      );
    }
  }

  const recipientEmail =
    req.body.email ||
    transaction.user_email ||
    transaction.user?.email ||
    transaction.partner?.email;

  if (!recipientEmail) {
    return res.status(status.BAD_REQUEST).json(
      response({
        status: "Error",
        statusCode: status.BAD_REQUEST,
        message: "No recipient email found for this transaction. Please provide one in the request body.",
      })
    );
  }

  const recipientName =
    req.body.fullName ||
    transaction.user?.fullName ||
    transaction.partner?.fullName ||
    "Valued Customer";

  let txType = "Booking Payment";
  if (transaction.paymentType === "credit") txType = "Wallet Credit Purchase";
  else if (transaction.paymentType === "withdraw") txType = "Wallet Withdrawal";
  else if (transaction.paymentType === "tip") txType = "Tip Payment";
  else if (transaction.paymentType === "refund") txType = "Booking Refund";

  const serviceName =
    transaction.service?.name ||
    transaction.service?.title ||
    transaction.booking_data?.serviceName ||
    undefined;

  const providerName =
    transaction.partner?.fullName ||
    transaction.booking_data?.partnerName ||
    undefined;

  const bookingId =
    transaction.booking?.bookingId ||
    transaction.booking?._id ||
    transaction.booking_data?.bookingId ||
    undefined;

  await sendTransactionEmail({
    email: recipientEmail,
    fullName: recipientName,
    transactionType: txType,
    amount: transaction.gross_amount || transaction.net_amount || 0,
    currency: transaction.currency || "NGN",
    paymentMethod: transaction.payment_method || "card",
    paymentStatus: transaction.payment_status || transaction.status || "successful",
    txRef: transaction.tx_ref,
    transactionId: transaction.transaction_id || transaction._id?.toString(),
    date: transaction.createdAt || new Date(),
    serviceName,
    providerName,
    bookingId,
    description: req.body.description || transaction.description,
  });

  return res.status(status.OK).json(
    response({
      status: "OK",
      statusCode: status.OK,
      message: "Transaction receipt email sent successfully",
      data: {
        transactionId: transaction._id,
        tx_ref: transaction.tx_ref,
        email: recipientEmail,
        amount: transaction.gross_amount || transaction.net_amount,
        paymentType: transaction.paymentType,
      },
    })
  );
});

module.exports = {
  sendTransactionEmailController,
  initializePayment,
  verifyPayment,
  bookController,
  cancelBooking,
  allTransactionController,
  earningController,
  holdPayoutController,
  doCompletePayoutController,
  allPayoutController,
  partnerMonthlySummaryController,
  partnerMonthlyCompletedPayoutController,
  purchaseCreditController,
  refundController,
  allPayoutOfAPartnerController,
  withdrawCreditController,
  tipsController,
  getBanks,
  renderSandboxCheckout,
};
