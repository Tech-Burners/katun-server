const Transaction = require("../modules/Transaction/transaction.model");
const bookingModel = require("../modules/Booking/booking.model");
const serviceModel = require("../modules/Service/service.model");
const userModel = require("../modules/User/user.model");
const partnerModel = require("../modules/Partner/partner.model");
const { sendNotificationByFcmToken } = require("./sendNotificationByFcmToken");



const normalizePaymentMethod = (method) => {
  if (!method) return "card";

  const m = method.toLowerCase();

  if (m.includes("card")) return "card";
  if (m.includes("bank")) return "banktransfer";
  if (m.includes("ussd")) return "ussd";
  if (m.includes("wallet")) return "wallet";

  return "card";
};

const flutterwaveWebhook = async (req, res) => {
  console.log("=======================================");

  try {

    // VERIFY FLUTTERWAVE
    if (req.headers["verif-hash"] !== process.env.FLW_SECRET_HASH)
      return res.status(401).end();

    const payload = req.body;

    if (payload.event !== "charge.completed")
      return res.status(200).end();

    const payment = payload.data;
    console.log({ payment });

    if (payment.status !== "successful")
      return res.status(200).end();

    const transaction = await Transaction.findOne({
      tx_ref: payment.tx_ref,
    });

    if (!transaction) return res.status(200).end();

    // VERY IMPORTANT (prevent duplicate webhook credit)
    if (transaction.payment_status === "successful")
      return res.status(200).end();


    // ======================
    // SAVE PAYMENT DATA
    // ======================
    transaction.transaction_id = payment.id;
    // transaction.payment_method = payment.payment_type || null;
    const rawMethod =
      payment.payment_type ||
      payment.channel ||
      payment.meta?.payment_method;

    transaction.payment_method = normalizePaymentMethod(rawMethod);

    transaction.bank_name =
      payment.bank_name ||
      payment.card?.issuer ||
      null;

    transaction.meta = payment;

    if (transaction.paymentType === "credit") {

      await userModel.findByIdAndUpdate(
        transaction.user,
        {
          $inc: {
            digitalWallet: transaction.gross_amount,
          },
        },
        { new: true }
      );

      transaction.payment_status = "successful";

      await transaction.save();

      return res.status(200).end();
    }


    //   if (transaction.paymentType === "tip") {
    //     await userModel.findByIdAndUpdate(
    //       transaction.partner, // already on the transaction, no meta needed
    //       { $inc: { digitalWallet: transaction.net_amount } },
    //       { new: true }
    //     );
    //     //tips
    // if (transaction.booking) {
    //   await bookingModel.findByIdAndUpdate(
    //     transaction.booking,
    //     {
    //       $inc: { tips: transaction.net_amount }
    //     }
    //   );
    // }

    //     transaction.payment_status = "successful";
    //     await transaction.save();

    //     return res.status(200).end();
    //   }

    if (transaction.paymentType === "tip") {
      await userModel.findByIdAndUpdate(
        transaction.partner,
        {
          $inc: {
            digitalWallet: transaction.net_amount,
          },
        },
        {
          new: true,
        }
      );

      // Update booking tips
      if (transaction.booking) {
        await bookingModel.findByIdAndUpdate(
          transaction.booking,
          {
            $inc: {
              tips: transaction.net_amount,
            },
          }
        );
      }

      // Send push notification to partner
      const sender = await userModel.findById(transaction.user);
      console.log({ sender })

      if (sender?.enabledPushNotification === true) {
        await sendNotificationByFcmToken(
          transaction.partner,
          "New Tip Received",
          `${sender?.fullName || "A customer"} sent you a tip of ₦${transaction.net_amount}.`,
          transaction.booking,
          "tip"
        );
      }

      transaction.payment_status = "successful";

      await transaction.save();

      return res.status(200).end();
    }


    // =====================================================
    // ✅ BOOKING PAYMENT FLOW
    // =====================================================
    if (transaction.booking_data) {

      const data = transaction.booking_data;

      const serviceData = await serviceModel.findById(data.service);

      if (!serviceData) return res.status(200).end();

      const sessions = serviceData?.pass?.noOfSessions || 1;
      const validity = serviceData?.pass?.validity || 1;

      const bookingPayload = {
        ...data,
        transaction: transaction._id,
        paymentStatus: "paid",
        status: data.status || "pending",
        paymentMethod: data.paymentMethod,
      };

      if (data.isOneTime) {
        bookingPayload.sessionLeft = 1;
        bookingPayload.expireDate =
          new Date(new Date(data.date).getTime() + 86400000);
      } else {
        bookingPayload.sessionLeft = sessions;
        bookingPayload.expireDate =
          new Date(
            new Date(data.date).getTime() + validity * 86400000
          );
      }

      // const booking = await bookingModel.create(bookingPayload);

      // transaction.booking = booking._id;
      // AFTER (create + notifications):
      const booking = await bookingModel.create(bookingPayload);
      transaction.booking = booking._id;

      // ── Push Notifications ──────────────────────────────────────
      const partnerDetails = await partnerModel.findOne({
        user: data.provider,
        isDeleted: false,
      });

      console.log({ partnerDetails })

      if (partnerDetails?.enabledPushNotification === true) {
        if (data.status === "approved") {
          // Auto-accept was ON: notify partner of scheduled job, customer of approval
          await sendNotificationByFcmToken(data.provider, "New Booking schedule");
          await sendNotificationByFcmToken(data.user, "Booking approved");
        } else {
          // Auto-accept was OFF: notify partner to review the request
          await sendNotificationByFcmToken(data.provider, "New Booking waiting for approval");
        }
      }
      // ────────────────────────────────────────────────────────────
    }

    transaction.payment_status = "successful";

    await transaction.save();

    return res.status(200).end();

  } catch (error) {
    console.log(error);
    return res.status(200).end();
  }
};


module.exports = flutterwaveWebhook;