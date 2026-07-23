const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    // =====================================================
    // FLUTTERWAVE REFERENCES
    // =====================================================

    tx_ref: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    transaction_id: {
      type: String,
      index: true,
    },


    // =====================================================
    // USER
    // =====================================================

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    user_email: {
      type: String,
      trim: true,
      lowercase: true,
    },


    // =====================================================
    // CREDIT OWNER
    // =====================================================
    //
    // For normal user credit:
    //
    // credit_owner_type = "user"
    // credit_owner_id   = User._id
    //
    // For HR/company credit:
    //
    // credit_owner_type = "company"
    // credit_owner_id   = Employer._id
    //
    // This prevents the webhook from guessing who
    // should receive the credit.
    //

    credit_owner_type: {
      type: String,
      enum: [
        "user",
        "company",
      ],
    },

    credit_owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },


    // =====================================================
    // PAYMENT INFORMATION
    // =====================================================

    currency: {
      type: String,
      default: "NGN",
      uppercase: true,
    },

    bank_name: {
      type: String,
    },

    payment_method: {
      type: String,
      enum: [
        "card",
        "wallet",
        "banktransfer",
        "ussd",
        "cash",
      ],
      default: "card",
    },


    // =====================================================
    // BOOKING
    // =====================================================

    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      index: true,
    },

    booking_data: {
      type: mongoose.Schema.Types.Mixed,
    },


    // =====================================================
    // FLUTTERWAVE RAW DATA
    // =====================================================

    meta: {
      type: mongoose.Schema.Types.Mixed,
    },


    // =====================================================
    // PARTNER / SERVICE
    // =====================================================

    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      index: true,
    },


    // =====================================================
    // AMOUNT
    // =====================================================

    gross_amount: {
      type: Number,
      required: true,
      min: 0,
    },

    commission: {
      type: Number,
      default: 0,
      min: 0,
    },

    net_amount: {
      type: Number,
      required: true,
      min: 0,
    },


    // =====================================================
    // GENERAL TRANSACTION STATUS
    // =====================================================

    status: {
      type: String,
      enum: [
        "pending",
        "successful",
        "failed",
        "refunded",
      ],
      default: "pending",
      index: true,
    },


    // =====================================================
    // PAYMENT STATUS
    // =====================================================
    //
    // pending:
    // Payment initialized but not confirmed.
    //
    // processing:
    // Webhook is currently processing this transaction.
    //
    // successful:
    // Payment successfully processed.
    //
    // failed:
    // Payment failed.
    //
    // refunded:
    // Payment refunded.
    //
    // paid:
    // Kept for backward compatibility.
    //
    // cancellation-fee:
    // Kept for your existing business logic.
    //

    payment_status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "successful",
        "failed",
        "refunded",
        "paid",
        "cancellation-fee",
      ],
      default: "pending",
      index: true,
    },


    // =====================================================
    // TRANSACTION TYPE
    // =====================================================

    paymentType: {
      type: String,
      enum: [
        "credit",
        "withdraw",
        "commission",
        "tip",
        "booking",
        "refund",
      ],
      required: true,
      index: true,
    },


    // =====================================================
    // PAYOUT
    // =====================================================

    payout_status: {
      type: String,
      enum: [
        "pending",
        "hold",
        "completed",
        "refund",
        "processing",
      ],
      default: "hold",
      index: true,
    },

    payoutCycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayoutCycle",
      index: true,
    },

    payout_completed_at: {
      type: Date,
    },


    // =====================================================
    // EXTRA INFORMATION
    // =====================================================

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    description: {
      type: String,
      trim: true,
    },
  },

  {
    timestamps: true,
  }
);


// =====================================================
// INDEXES
// =====================================================

// tx_ref already has unique: true,
// but keeping this explicit is fine.
transactionSchema.index(
  { tx_ref: 1 },
  { unique: true }
);


// Useful for webhook lookup
transactionSchema.index({
  tx_ref: 1,
  payment_status: 1,
});


// Useful for partner payout queries
transactionSchema.index({
  partner: 1,
  payout_status: 1,
  payment_status: 1,
});


// Useful for payment history
transactionSchema.index({
  user: 1,
  createdAt: -1,
});


// Useful for payout cycle processing
transactionSchema.index({
  payoutCycle: 1,
  payout_status: 1,
});


// =====================================================
// MODEL
// =====================================================

module.exports =
  mongoose.model(
    "Transaction",
    transactionSchema
  );


  

// const mongoose = require("mongoose");

// const transactionSchema = new mongoose.Schema(
//   {
//     tx_ref: { type: String, unique: true },

//     transaction_id: String,

//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//     },

//     user_email: String,

//     currency: String,

//     bank_name: String,

//     booking: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Booking",
//     },

//     booking_data: Object,

//     meta: Object,

//     partner: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//     },
//     service: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Service",
//     },
//     // amount: Number,
//     gross_amount: Number,
//     commission: Number,
//     net_amount: Number,
//     status: {
//       type: String,
//       enum: ["pending", "successful", "failed", "refunded"],
//       default: "pending",
//     },
//     payment_status: {
//       type: String,
//       enum: ["pending", "successful", "failed", "refunded", "paid", "cancellation-fee"],
//       default: "pending",
//     },
//     // reference: String,
//     referenceId: mongoose.Schema.Types.ObjectId,
//     description: String,
//     payment_method: {
//       type: String,
//       enum: ["card", "wallet", "banktransfer", "cash"],
//       default: "card",
//     },
//     payout_status: {
//       type: String,
//       enum: ["pending", "hold", "completed", "refund", "processing"],
//       default: "hold",
//     },

//     paymentType: {
//       type: String,
//       enum: ["credit", "withdraw", "commission", "tip", "booking", "refund"]
//     },

//     payout_completed_at: Date,
//     partner: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//     },
//     payoutCycle: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "PayoutCycle",
//       index: true,
//     },

//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("Transaction", transactionSchema);