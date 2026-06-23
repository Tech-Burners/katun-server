const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    tx_ref: { type: String, unique: true },

    transaction_id: String,

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    user_email: String,

    currency: String,

    bank_name: String,

    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },

    booking_data: Object,

    meta: Object,

    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
    },
    // amount: Number,
    gross_amount: Number,
    commission: Number,
    net_amount: Number,
    status: {
      type: String,
      enum: ["pending", "successful", "failed", "refunded"],
      default: "pending",
    },
    payment_status: {
      type: String,
      enum: ["pending", "successful", "failed", "refunded", "paid", "cancellation-fee"],
      default: "pending",
    },
    // reference: String,
    referenceId: mongoose.Schema.Types.ObjectId,
    description: String,
    payment_method: {
      type: String,
      enum: ["card", "wallet", "banktransfer", "cash"],
      default: "card",
    },
    payout_status: {
      type: String,
      enum: ["pending", "hold", "completed", "refund", "processing"],
      default: "hold",
    },

    paymentType: {
      type: String,
      enum: ["credit", "withdraw", "commission", "tip"]
    },

    payout_completed_at: Date,
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    payoutCycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayoutCycle",
      index: true,
    },

  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);