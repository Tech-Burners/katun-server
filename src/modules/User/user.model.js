const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: false },
  email: { type: String, required: false, trim: true },
  phoneNumber: { type: String },
  // whatsappNumber: { type: String },
  image: { type: String, required: false, default: '/uploads/users/user.jpg' },
  role: { type: String, enum: ['user', 'hr', 'sub_hr_admin', 'partner', 'admin'], default: 'user' },
  isLoginToken: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  isBan: { type: Boolean, default: false },
  bookingCompleted: { type: Number, default: 0 },
  reportCount: { type: Number, default: 0 },
  flagCount: { type: Number, default: 0 },
  note: { type: String, default: "" },
  isDeleted: { type: Boolean, default: false },
  password: { type: String, required: false },
  wallet: { type: Number, default: 0 },
  digitalWallet: { type: Number, default: 0, set: v => Math.round(v * 100) / 100 },
  totalRevenue: { type: Number, default: 0, set: v => Math.round(v * 100) / 100 },
  usages: { type: Number, default: 0 },
  location: {
    type: { type: String, enum: ["Point"] },
    coordinates: { type: [Number] },
  },
  address: { type: String, required: false },
  payoutFrequency: {
  type: String,
  enum: ["weekly", "monthly", "instant"],
  default: "monthly",
},

lastFrequencyChange: {
  type: Date
},
fcmToken: {
  type: String,
  required: false,
},

activePayoutCycle: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "PayoutCycle",
},
},
  {
    timestamps: true
  }
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.index({ location: "2dsphere" });

module.exports = mongoose.model('User', userSchema);