const crypto = require("crypto");
const axios = require("axios");

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

const { default: status } =
  require("http-status");

const response =
  require("../../helpers/response");

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

const { search } = require("./transaction.route");


const { getAllTransactions, getPendingPayoutService, getcompletePayoutService,
  payoutStatusUpdateService,
  getPartnerMonthlySummaryService, comnpletePayoutService, holdPayoutService,
  getPartnerMonthlyCompletedPayoutService, getAllPayoutService,
  getPlatformEarningTransactionsService, allPayoutOfAPartnerService,
  getAllRefundData, withdrawCreditService } = require("./transaction.service");
const employerModel = require("../Employer/employer.model");




const generateTxRef = () => {
  return `txn_${Date.now()}_${crypto.randomUUID()}`;
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
    // VALIDATION
    // =====================================================

    if (!service || !partner) {
      return res.status(400).json({
        message:
          "Service and partner are required",
      });
    }


    const grossAmount =
      Number(totalPrice);


    if (
      !Number.isFinite(grossAmount) ||
      grossAmount <= 0
    ) {
      return res.status(400).json({
        message:
          "Invalid payment amount",
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


    const partnerDetails =
      await partnerModel.findOne({
        user: partner,
      });
const partnerUserDoc = await getUserById(partnerDetails.user);
    const isAutoApproved =
      Boolean(
        partnerDetails?.serviceAutoApproved
      );


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
        isOneTime,
        servicePrice,
        totalPrice,
        addons,
        paymentMethod,
        status:
          isAutoApproved
            ? "approved"
            : "pending",
      };


      const booking =
        await bookingService(
          bookingData
        );


      // Send notifications
      if (
        partnerDetails
          ?.enabledPushNotification === true
      ) {

        if (isAutoApproved) {

          await sendNotificationByFcmToken(
            partner,
            "New Booking",
            "New Booking schedule",
            booking._id,
            "booking"
          );
          console.log(partnerUserDoc.email );
          await emailWithNodemailer({
            email: partnerUserDoc.email,
            subject: "New Booking",
            html: `<p>New Booking schedule</p>`,
          })


          await addNotificationService({
            sender: userId,
            targetUser: partner,
            title: "New Booking",
            message:
              "New Booking schedule",
            type: "booking",
            bookingId:
              booking._id,
          });


          const userData =
            await userModel.findById(
              userId
            );


          if (
            userData
              ?.enabledPushNotification
          ) {

            await sendNotificationByFcmToken(
              userId,
              "New Booking",
              "Booking approved",
              booking._id,
              "booking"
            );
          }


          await addNotificationService({
            sender: partner,
            targetUser: userId,
            title: "Booking approved",
            message:
              "Your booking has been approved",
            type: "booking",
            bookingId:
              booking._id,
          });
          console.log({ userData });
console.log(userData.email );
          await emailWithNodemailer({
            email: userData.email,
            subject: "Booking approved",
            html: `<p>Your booking has been approved</p>`,
          })

        } else {

          await sendNotificationByFcmToken(
            partner,
            "New Booking",
            "New Booking waiting for approval",
            booking._id,
            "booking"
          );


          await addNotificationService({
            sender: userId,
            targetUser: partner,
            title: "New Booking",
            message:
              "New Booking waiting for approval",
            type: "booking",
            bookingId:
              booking._id,
          });

          await emailWithNodemailer({
            email: partnerUserDoc.email,
            subject: "New Booking",
            html: `<p>New Booking waiting for approval</p>`,
          })
        }
      }


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

      // IMPORTANT:
      // Your existing code directly creates the booking
      // without showing any wallet balance deduction.
      //
      // This should be handled atomically in your booking
      // service before creating the booking.
      //
      // If bookingService already handles wallet deduction,
      // keep this behavior.
      //
      // If it does not, DO NOT allow wallet booking until
      // the balance is checked and deducted atomically.

      const bookingData = {
        user: userId,
        service,
        provider: partner,
        date,
        startTime,
        endTime,
        isOneTime,
        servicePrice,
        totalPrice,
        addons,
        paymentMethod,
        status:
          isAutoApproved
            ? "approved"
            : "pending",
      };


      const booking =
        await bookingService(
          bookingData
        );


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


    const commissionRate = 0.10;


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

          isOneTime,

          servicePrice,

          totalPrice,

          addons,

          pin,

          paymentMethod,

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
              process.env.FLW_SUCCESS_URL,

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


      const paymentLink =
        paymentResponse
          ?.data
          ?.data
          ?.link;


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
              process.env.FLW_SUCCESS_URL,

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


      const paymentLink =
        paymentResponse
          ?.data
          ?.data
          ?.link;


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
              process.env.FLW_SUCCESS_URL,

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


      const paymentLink =
        paymentResponse
          ?.data
          ?.data
          ?.link;


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




const verifyPayment = catchAsync(
  async (req, res) => {

    const {
      transaction_id,
    } = req.query;


    if (
      !transaction_id
    ) {

      return res.status(400).json({
        message:
          "Transaction ID is required",
      });
    }


    const payment =
      await verifyFlutterwavePayment(
        transaction_id
      );


    if (
      !payment
    ) {

      return res.status(404).json({
        message:
          "Payment not found",
      });
    }


    const transaction =
      await Transaction.findOne({
        tx_ref:
          payment.tx_ref,
      });


    if (
      !transaction
    ) {

      return res.status(404).json({
        message:
          "Local transaction not found",
      });
    }


    return res.status(200).json({

      success:
        true,

      paymentStatus:
        transaction.payment_status,

      flutterwaveStatus:
        payment.status,

      tx_ref:
        payment.tx_ref,

      transaction_id:
        payment.id,
    });
  }
);
























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



const getBanks = catchAsync(async (req, res) => {
  // const { country} = req.query; // default Nigeria
  // console.log(`https://api.flutterwave.com/v3/banks/${country}`)
  const response = await axios.get(
    `https://api.flutterwave.com/v3/banks/NG`,
    {
      headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
    }
  );

  ;
  res.json(response.data); // returns { status, message, data: [{ id, code, name }] }
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
    const { amount, email, name } = req.body;
    const tx_ref = "txn_" + Date.now();

    // Save initial transaction as pending
    await Transaction.create({
      tx_ref,
      user_email: email,
      amount,
      currency: "NGN",
      status: "pending",
    });

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref,
        amount,
        currency: "NGN",
        redirect_url: process.env.FLW_SUCCESS_URL,
        payment_options: "card,banktransfer",
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

    res.json({
      paymentLink: response.data.data.link,
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
    await Transaction.findByIdAndUpdate(originalTransactionId, {
      payout_status: "refund",
      payment_status: "refunded",
      status: "refunded",
      paymentType: "refund",
    });
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
    const receiverData = await userModel.findById(booking.user)
    // console.log({ receiverData })
    if (receiverData?.enabledPushNotification === true) {
      await sendNotificationByFcmToken(
        booking.user,
        'booking cancellation',
        "Booking cancelled by partner",
        booking._id,
        'booking'
      )
    }

    await addNotificationService({
      sender: booking.provider,
      targetUser: booking.user,
      title: "Booking cancelled",
      message: "Booking cancelled by partner",
      type: "booking",
      bookingId: booking._id
    })
  } else if (cancelledBy === "user") {
    const providerData = await userModel.findById(booking.provider)
    // console.log({ providerData })
    if (providerData?.enabledPushNotification === true) {
      await sendNotificationByFcmToken(
        booking.provider,
        'booking cancellation',
        "Booking cancelled by user",
        booking._id,
        'booking'
      )
    }
    await addNotificationService({
      sender: booking.user,
      targetUser: booking.provider,
      title: "Booking cancelled",
      message: "Booking cancelled by user",
      type: "booking",
      bookingId: booking._id
    })
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



module.exports = {
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
  getBanks
};
