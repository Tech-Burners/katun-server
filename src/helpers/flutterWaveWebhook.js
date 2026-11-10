const axios = require("axios");

const Transaction =
  require("../modules/Transaction/transaction.model");

const bookingModel =
  require("../modules/Booking/booking.model");

const serviceModel =
  require("../modules/Service/service.model");

const userModel =
  require("../modules/User/user.model");

const partnerModel =
  require("../modules/Partner/partner.model");

const employerModel =
  require("../modules/Employer/employer.model");

const payoutCycleModel =
  require("../modules/Payout/payoutCycle.model");

const {
  sendNotificationByFcmToken,
} = require("./sendNotificationByFcmToken");

const {
  addNotificationService,
} = require("../modules/Notification/notification.service");

const {
  emailWithNodemailer,
} = require("./email");

const {
  calculateBookingRequestExpireAt,
  sendNewBookingNotifications,
  getAppointmentStartTime,
} = require("../modules/Booking/bookingExpiry.service");


// =====================================================
// NORMALIZE PAYMENT METHOD
// =====================================================

const normalizePaymentMethod = (
  method
) => {

  if (!method) {
    return "card";
  }

  const value =
    String(method)
      .toLowerCase();


  if (
    value.includes("card")
  ) {
    return "card";
  }


  if (
    value.includes("bank")
  ) {
    return "banktransfer";
  }


  if (
    value.includes("ussd")
  ) {
    return "ussd";
  }


  if (
    value.includes("wallet")
  ) {
    return "wallet";
  }


  return "card";
};


// =====================================================
// VERIFY PAYMENT DIRECTLY WITH FLUTTERWAVE
// =====================================================

const verifyFlutterwavePayment =
  async (transactionId) => {

    const response =
      await axios.get(

        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,

        {
          headers: {
            Authorization:
              `Bearer ${process.env.FLW_SECRET_KEY}`,
          },

          timeout: 15000,
        }
      );


    return response
      ?.data
      ?.data;
  };


// =====================================================
// UPDATE PAYOUT CYCLE
// =====================================================

const updatePayoutCycle =
  async (transaction) => {

    if (
      !transaction.payoutCycle
    ) {
      return;
    }


    // Add transaction only once
    await payoutCycleModel.updateOne(
      {
        _id:
          transaction.payoutCycle,

        status: {
          $ne: "completed",
        },
      },

      {
        $addToSet: {
          transactions:
            transaction._id,
        },
      }
    );


    const cycle =
      await payoutCycleModel.findById(
        transaction.payoutCycle
      );


    if (!cycle) {
      return;
    }


    // Recalculate total from actual transactions
    const transactions =
      await Transaction.find({
        _id: {
          $in:
            cycle.transactions,
        },

        payment_status: {
          $in: [
            "successful",
            "paid",
          ],
        },

        payout_status: {
          $in: [
            "pending",
            "hold",
            "processing",
          ],
        },
      })
        .select(
          "net_amount"
        )
        .lean();


    const totalAmount =
      transactions.reduce(
        (
          total,
          item
        ) => {

          return (
            total +
            Number(
              item.net_amount || 0
            )
          );

        },
        0
      );


    await payoutCycleModel.updateOne(
      {
        _id:
          cycle._id,
      },

      {
        $set: {
          totalAmount:
            Number(
              totalAmount.toFixed(2)
            ),
        },
      }
    );
  };


// =====================================================
// WEBHOOK
// =====================================================

const flutterwaveWebhook =
  async (req, res) => {

    console.log(
      "Flutterwave webhook received"
    );


    let transaction = null;


    try {

      // =================================================
      // 1. VERIFY WEBHOOK HASH
      // =================================================

      const webhookHash =
        req.headers[
          "verif-hash"
        ];


      if (
        !webhookHash ||
        webhookHash !==
          process.env.FLW_SECRET_HASH
      ) {

        console.error(
          "Invalid Flutterwave webhook hash"
        );

        return res
          .status(401)
          .end();
      }


      // =================================================
      // 2. VALIDATE PAYLOAD
      // =================================================

      const payload =
        req.body;


      if (
        !payload ||
        !payload.data
      ) {

        return res
          .status(400)
          .end();
      }


      // =================================================
      // 3. ONLY PROCESS CHARGE COMPLETED
      // =================================================

      if (
        payload.event !==
        "charge.completed"
      ) {

        return res
          .status(200)
          .end();
      }


      const payment =
        payload.data;


      if (
        !payment.tx_ref ||
        !payment.id
      ) {

        return res
          .status(400)
          .end();
      }


      // =================================================
      // 4. ONLY SUCCESSFUL PAYMENTS
      // =================================================

      if (
        payment.status !==
        "successful"
      ) {

        return res
          .status(200)
          .end();
      }


      // =================================================
      // 5. FIND LOCAL TRANSACTION
      // =================================================

      const existingTransaction =
        await Transaction.findOne({
          tx_ref:
            payment.tx_ref,
        });


      if (
        !existingTransaction
      ) {

        console.error(
          "Transaction not found:",
          payment.tx_ref
        );

        return res
          .status(200)
          .end();
      }


      // =================================================
      // 6. DUPLICATE PROTECTION
      // =================================================

      if (
        existingTransaction
          .payment_status ===
        "successful"
      ) {

        return res
          .status(200)
          .end();
      }


      // =================================================
      // 7. ATOMICALLY CLAIM PAYMENT
      // =================================================
      //
      // pending → processing
      //
      // Only ONE webhook can successfully
      // change the transaction.
      //

      transaction =
        await Transaction.findOneAndUpdate(

          {
            _id:
              existingTransaction._id,

            payment_status:
              "pending",
          },

          {
            $set: {
              payment_status:
                "processing",

              transaction_id:
                payment.id,
            },
          },

          {
            new: true,
          }
        );


      if (
        !transaction
      ) {

        // Another webhook is already processing it
        return res
          .status(200)
          .end();
      }


      // =================================================
      // 8. VERIFY PAYMENT WITH FLUTTERWAVE
      // =================================================

      const verifiedPayment =
        await verifyFlutterwavePayment(
          payment.id
        );


      if (
        !verifiedPayment
      ) {

        throw new Error(
          "Unable to verify Flutterwave payment"
        );
      }


      // =================================================
      // 9. VERIFY PAYMENT STATUS
      // =================================================

      if (
        verifiedPayment.status !==
        "successful"
      ) {

        transaction.payment_status =
          "failed";

        transaction.status =
          "failed";

        await transaction.save();

        return res
          .status(200)
          .end();
      }


      // =================================================
      // 10. VERIFY TX REF
      // =================================================

      if (
        verifiedPayment.tx_ref !==
        transaction.tx_ref
      ) {

        throw new Error(
          "Flutterwave tx_ref mismatch"
        );
      }


      // =================================================
      // 11. VERIFY CURRENCY
      // =================================================

      if (
        verifiedPayment.currency !==
        transaction.currency
      ) {

        throw new Error(
          "Flutterwave currency mismatch"
        );
      }


      // =================================================
      // 12. VERIFY AMOUNT
      // =================================================

      const expectedAmount =
        Number(
          transaction.gross_amount
        );


      const paidAmount =
        Number(
          verifiedPayment.amount
        );


      if (
        Math.abs(
          expectedAmount -
          paidAmount
        ) > 0.01
      ) {

        throw new Error(
          "Flutterwave payment amount mismatch"
        );
      }


      // =================================================
      // 13. SAVE PAYMENT INFORMATION
      // =================================================

      const rawMethod =
        verifiedPayment.payment_type ||
        verifiedPayment.channel ||
        verifiedPayment.meta
          ?.payment_method;


      transaction.transaction_id =
        verifiedPayment.id;


      transaction.payment_method =
        normalizePaymentMethod(
          rawMethod
        );


      transaction.bank_name =
        verifiedPayment.bank_name ||
        verifiedPayment.card
          ?.issuer ||
        null;


      transaction.meta =
        verifiedPayment;


      // =================================================
      // 14. CREDIT PAYMENT
      // =================================================

      if (
        transaction.paymentType ===
        "credit"
      ) {

        if (
          transaction.credit_owner_type ===
          "company"
        ) {

          await employerModel.findByIdAndUpdate(

            transaction.credit_owner_id,

            {
              $inc: {
                creditBalance:
                  transaction.gross_amount,
              },
            }
          );

        } else {

          await userModel.findByIdAndUpdate(

            transaction.credit_owner_id ||
            transaction.user,

            {
              $inc: {
                digitalWallet:
                  transaction.gross_amount,
                rechargedCredit:
                  transaction.gross_amount,
              },
            }
          );
        }


        transaction.payment_status =
          "successful";

        transaction.status =
          "successful";


        await transaction.save();


        // Notification & Push Notification for Credit Purchase
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

            // 1. Push Notification
            if (targetUser.enabledPushNotification !== false) {
              await sendNotificationByFcmToken(
                targetUser._id,
                title,
                message,
                undefined,
                "credit"
              );
            }

            // 2. In-App Notification (Database)
            const notif = await addNotificationService({
              targetUser: targetUser._id,
              title,
              message,
              type: "credit",
            });

            // 3. Socket Emit
            if (global.io) {
              global.io.emit(`get notification::${targetUser._id}`, {
                status: 200,
                message: title,
                data: notif,
              });
              global.io.emit("get notification", {
                status: 200,
                message: "New notification available",
                data: notif,
              });
            }

            // 4. Email Notification (Transaction Receipt)
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
        } catch (creditNotifError) {
          console.error("Credit notification error:", creditNotifError.message);
        }


        return res
          .status(200)
          .end();
      }


      // =================================================
      // 15. TIP PAYMENT
      // =================================================

      if (
        transaction.paymentType ===
        "tip"
      ) {

        await userModel.findByIdAndUpdate(

          transaction.partner,

          {
            $inc: {
              digitalWallet:
                transaction.net_amount,
            },
          }
        );


        if (
          transaction.booking
        ) {

          await bookingModel.findByIdAndUpdate(

            transaction.booking,

            {
              $inc: {
                tips:
                  transaction.net_amount,
              },
            }
          );
        }


        // Mark successful
        transaction.payment_status =
          "successful";

        transaction.status =
          "successful";

        transaction.payout_status =
          "pending";

        await transaction.save();

        // Update payout cycle AFTER saving successful status
        await updatePayoutCycle(
          transaction
        );


        // Notification & Push Notification for Tip
        try {
          const sender =
            await userModel.findById(
              transaction.user
            );

          const partnerUser =
            await userModel.findById(
              transaction.partner
            );

          const tipAmount = transaction.net_amount || transaction.gross_amount;
          const senderName = sender?.fullName || "A customer";
          const partnerName = partnerUser?.fullName || "the provider";

          // 1. Notify Partner (Receiver of Tip)
          if (partnerUser) {
            const partnerTitle = "Tip Received";
            const partnerMessage = `${senderName} sent you a tip of ₦${tipAmount}.`;

            // Push Notification to Partner
            if (partnerUser.enabledPushNotification !== false) {
              await sendNotificationByFcmToken(
                partnerUser._id,
                partnerTitle,
                partnerMessage,
                transaction.booking,
                "tip"
              );
            }

            // In-App Notification to Partner (Database)
            const partnerNotif = await addNotificationService({
              sender: transaction.user || undefined,
              targetUser: partnerUser._id,
              title: partnerTitle,
              message: partnerMessage,
              type: "tip",
              bookingId: transaction.booking || undefined,
            });

            // Socket Emit to Partner
            if (global.io) {
              global.io.emit(`get notification::${partnerUser._id}`, {
                status: 200,
                message: partnerTitle,
                data: partnerNotif,
              });
              global.io.emit("get notification", {
                status: 200,
                message: "New notification available",
                data: partnerNotif,
              });
            }

            // Email to Partner (Transaction Receipt)
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

          // 2. Notify Sender (Customer who gave Tip)
          if (sender) {
            const senderTitle = "Tip Sent Successfully";
            const senderMessage = `Your tip of ₦${transaction.gross_amount} to ${partnerName} was successful.`;

            // Push Notification to Sender
            if (sender.enabledPushNotification !== false) {
              await sendNotificationByFcmToken(
                sender._id,
                senderTitle,
                senderMessage,
                transaction.booking,
                "tip"
              );
            }

            // In-App Notification to Sender (Database)
            const senderNotif = await addNotificationService({
              sender: transaction.partner || undefined,
              targetUser: sender._id,
              title: senderTitle,
              message: senderMessage,
              type: "tip",
              bookingId: transaction.booking || undefined,
            });

            // Socket Emit to Sender
            if (global.io) {
              global.io.emit(`get notification::${sender._id}`, {
                status: 200,
                message: senderTitle,
                data: senderNotif,
              });
            }

            // Email to Sender (Transaction Receipt)
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

        } catch (
          notificationError
        ) {

          console.error(
            "Tip notification error:",
            notificationError.message
          );
        }


        return res
          .status(200)
          .end();
      }


      // =================================================
      // 16. BOOKING PAYMENT
      // =================================================

      if (
        transaction.booking_data
      ) {

        const data =
          transaction.booking_data;


        const serviceData =
          await serviceModel.findById(
            data.service
          );


        if (
          !serviceData
        ) {

          throw new Error(
            "Service not found"
          );
        }


        // =================================================
        // CHECK EXISTING BOOKING
        // =================================================

        let booking =
          await bookingModel.findOne({
            transaction:
              transaction._id,
          });


        // =================================================
        // CREATE BOOKING ONLY ONCE
        // =================================================

        if (
          !booking
        ) {

          const sessions =
            serviceData
              ?.pass
              ?.noOfSessions ||
            1;


          const validity =
            serviceData
              ?.pass
              ?.validity ||
            1;


          const bookingPayload = {

            ...data,

            transaction:
              transaction._id,

            paymentStatus:
              "paid",

            status:
              data.status ||
              "pending",

            paymentMethod:
              transaction.payment_method,

            bookingRequestExpireAt:
              data.bookingRequestExpireAt
                ? new Date(data.bookingRequestExpireAt)
                : calculateBookingRequestExpireAt(data),

            expiryReminderSent:
              Boolean(data.expiryReminderSent),
          };


          const appointmentBase = getAppointmentStartTime(data) || (data.date ? new Date(data.date) : new Date());
          const baseTime = !isNaN(appointmentBase.getTime()) ? appointmentBase.getTime() : Date.now();

          if (
            data.isOneTime
          ) {

            bookingPayload.sessionLeft =
              1;


            bookingPayload.expireDate =
              new Date(
                baseTime +
                86400000
              );

          } else {

            bookingPayload.sessionLeft =
              sessions;


            bookingPayload.expireDate =
              new Date(
                baseTime +
                validity *
                86400000
              );
          }


          try {

            booking =
              await bookingModel.create(
                bookingPayload
              );

          } catch (
            bookingError
          ) {

            // Duplicate key means another
            // webhook created it.
            if (
              bookingError.code ===
              11000
            ) {

              booking =
                await bookingModel.findOne({
                  transaction:
                    transaction._id,
                });

            } else {

              throw bookingError;
            }
          }
        }


        transaction.booking =
          booking._id;


        // =================================================
        // MARK SUCCESSFUL
        // =================================================

        transaction.payment_status =
          "successful";

        transaction.status =
          "successful";

        transaction.payout_status =
          "pending";

        await transaction.save();

        // =================================================
        // UPDATE PAYOUT CYCLE
        // =================================================

        await updatePayoutCycle(
          transaction
        );


        // =================================================
        // NOTIFICATIONS FOR NEW BOOKING (USER & PROVIDER)
        // =================================================

        await sendNewBookingNotifications(
          booking
        );


        return res
          .status(200)
          .end();
      }


      // =================================================
      // UNKNOWN PAYMENT TYPE
      // =================================================

      throw new Error(
        `Unknown payment type: ${transaction.paymentType}`
      );

    } catch (error) {

      console.error(
        "Flutterwave webhook error:",
        error
      );


      // Reset processing so Flutterwave
      // can retry the webhook.
      if (
        transaction?._id
      ) {

        await Transaction.findByIdAndUpdate(

          transaction._id,

          {
            $set: {
              payment_status:
                "pending",
            },
          }
        );
      }


      return res
        .status(500)
        .end();
    }
  };


module.exports =
  flutterwaveWebhook;




// const Transaction = require("../modules/Transaction/transaction.model");
// const bookingModel = require("../modules/Booking/booking.model");
// const serviceModel = require("../modules/Service/service.model");
// const userModel = require("../modules/User/user.model");
// const partnerModel = require("../modules/Partner/partner.model");
// const { sendNotificationByFcmToken } = require("./sendNotificationByFcmToken");



// const normalizePaymentMethod = (method) => {
//   if (!method) return "card";

//   const m = method.toLowerCase();

//   if (m.includes("card")) return "card";
//   if (m.includes("bank")) return "banktransfer";
//   if (m.includes("ussd")) return "ussd";
//   if (m.includes("wallet")) return "wallet";

//   return "card";
// };

// const flutterwaveWebhook = async (req, res) => {
//   console.log("=======================================");

//   try {

//     // VERIFY FLUTTERWAVE
//     if (req.headers["verif-hash"] !== process.env.FLW_SECRET_HASH)
//       return res.status(401).end();

//     const payload = req.body;

//     if (payload.event !== "charge.completed")
//       return res.status(200).end();

//     const payment = payload.data;
//     // console.log({ payment });

//     if (payment.status !== "successful")
//       return res.status(200).end();

//     const transaction = await Transaction.findOne({
//       tx_ref: payment.tx_ref,
//     });

//     if (!transaction) return res.status(200).end();

//     // VERY IMPORTANT (prevent duplicate webhook credit)
//     if (transaction.payment_status === "successful")
//       return res.status(200).end();


//     // ======================
//     // SAVE PAYMENT DATA
//     // ======================
//     transaction.transaction_id = payment.id;
//     // transaction.payment_method = payment.payment_type || null;
//     const rawMethod =
//       payment.payment_type ||
//       payment.channel ||
//       payment.meta?.payment_method;

//     transaction.payment_method = normalizePaymentMethod(rawMethod);

//     transaction.bank_name =
//       payment.bank_name ||
//       payment.card?.issuer ||
//       null;

//     transaction.meta = payment;

//     if (transaction.paymentType === "credit") {

//       await userModel.findByIdAndUpdate(
//         transaction.user,
//         {
//           $inc: {
//             digitalWallet: transaction.gross_amount,
//           },
//         },
//         { new: true }
//       );

//       transaction.payment_status = "successful";

//       await transaction.save();

//       return res.status(200).end();
//     }


//     if (transaction.paymentType === "tip") {
//       await userModel.findByIdAndUpdate(
//         transaction.partner,
//         {
//           $inc: {
//             digitalWallet: transaction.net_amount,
//           },
//         },
//         {
//           new: true,
//         }
//       );

//       // Update booking tips
//       if (transaction.booking) {
//         await bookingModel.findByIdAndUpdate(
//           transaction.booking,
//           {
//             $inc: {
//               tips: transaction.net_amount,
//             },
//           }
//         );
//       }

//       // Send push notification to partner
//       const sender = await userModel.findById(transaction.user);
//       // console.log({ sender })

//       if (sender?.enabledPushNotification === true) {
//         await sendNotificationByFcmToken(
//           transaction.partner,
//           "New Tip Received",
//           `${sender?.fullName || "A customer"} sent you a tip of ₦${transaction.net_amount}.`,
//           transaction.booking,
//           "tip"
//         );
//       }

//       transaction.payment_status = "successful";

//       await transaction.save();

//       return res.status(200).end();
//     }


//     // =====================================================
//     // ✅ BOOKING PAYMENT FLOW
//     // =====================================================
//     if (transaction.booking_data) {

//       const data = transaction.booking_data;

//       const serviceData = await serviceModel.findById(data.service);

//       if (!serviceData) return res.status(200).end();

//       const sessions = serviceData?.pass?.noOfSessions || 1;
//       const validity = serviceData?.pass?.validity || 1;

//       const bookingPayload = {
//         ...data,
//         transaction: transaction._id,
//         paymentStatus: "paid",
//         status: data.status || "pending",
//         paymentMethod: data.paymentMethod,
//       };

//       if (data.isOneTime) {
//         bookingPayload.sessionLeft = 1;
//         bookingPayload.expireDate =
//           new Date(new Date(data.date).getTime() + 86400000);
//       } else {
//         bookingPayload.sessionLeft = sessions;
//         bookingPayload.expireDate =
//           new Date(
//             new Date(data.date).getTime() + validity * 86400000
//           );
//       }

//       // const booking = await bookingModel.create(bookingPayload);

//       // transaction.booking = booking._id;
//       // AFTER (create + notifications):
//       const booking = await bookingModel.create(bookingPayload);
//       transaction.booking = booking._id;

//       // ── Push Notifications ──────────────────────────────────────
//       const partnerDetails = await partnerModel.findOne({
//         user: data.provider,
//         isDeleted: false,
//       });

//       // console.log({ partnerDetails })

//       if (partnerDetails?.enabledPushNotification === true) {
//         if (data.status === "approved") {
//           // Auto-accept was ON: notify partner of scheduled job, customer of approval
//           await sendNotificationByFcmToken(data.provider, "New Booking schedule");
//           await sendNotificationByFcmToken(data.user, "Booking approved");
//         } else {
//           // Auto-accept was OFF: notify partner to review the request
//           await sendNotificationByFcmToken(data.provider, "New Booking waiting for approval");
//         }
//       }
//       // ────────────────────────────────────────────────────────────
//     }

//     transaction.payment_status = "successful";

//     await transaction.save();

//     return res.status(200).end();

//   } catch (error) {
//     console.log(error);
//     return res.status(200).end();
//   }
// };


// module.exports = flutterwaveWebhook;