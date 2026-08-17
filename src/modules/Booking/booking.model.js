const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    date: Date,

    startTime: Date,

    endTime: Date,

    servicePrice: Number,

    totalPrice: Number,

    addons: [
      {
        serviceName: {
          type: String,
        },

        price: {
          type: Number,
        },
      },
    ],

    pass: {
      passName: String,

      price: Number,

      noOfSessions: Number,

      validity: Number,
    },

    tips: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: [
        "card",
        "banktransfer",
        "ussd",
        "cash",
        "wallet",
      ],
    },

    transaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "cancelled",
        "completed",
      ],
      default: "pending",
    },

    paymentStatus: {
      type: String,
      enum: [
        "pending",
        "paid",
        "failed",
        "refunded",
      ],
      default: "pending",
    },

    reason: String,

    pin: String,
    pinVerified: {
      type: Boolean,
      default: false,
    },

    checkin: Date,

    isOneTime: {
      type: Boolean,
      default: false,
    },

    sessionLeft: Number,

    expireDate: Date,
  },
  {
    timestamps: true,
  }
);


// =====================================================
// BOOKING ID
// =====================================================

bookingSchema.pre(
  "save",
  async function (next) {
    try {
      if (!this.bookingId) {
        const random =
          Math.floor(
            1000 +
            Math.random() *
            9000
          );

        const count =
          await mongoose
            .model("Booking")
            .countDocuments();

        const shortTime =
          Date.now()
            .toString()
            .slice(-6);

        this.bookingId =
          `BK-${shortTime}-${count + 1}-${random}`;
      }

      next();

    } catch (error) {
      next(error);
    }
  }
);


// =====================================================
// IMPORTANT
// ONE TRANSACTION = ONE BOOKING
// =====================================================

bookingSchema.index(
  {
    transaction: 1,
  },
  {
    unique: true,
    sparse: true,
  }
);


module.exports =
  mongoose.model(
    "Booking",
    bookingSchema
  );

  


