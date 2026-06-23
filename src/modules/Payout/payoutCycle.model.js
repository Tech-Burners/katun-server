const mongoose = require("mongoose");

const payoutCycleSchema = new mongoose.Schema(
  {
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["weekly", "monthly", "instant"],
      required: true,
    },

    startDate: Date,
    endDate: Date,

    status: {
      type: String,
      enum: ["open", "processing", "completed"],
      default: "open",
    },

    totalAmount: {
      type: Number,
      default: 0,
    },

    transactions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("PayoutCycle", payoutCycleSchema);