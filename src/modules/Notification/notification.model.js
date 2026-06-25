const mongoose = require("mongoose");



const notificationSchema = new mongoose.Schema({
  sender: { type: mongoose.Types.ObjectId, ref: 'User', required: false },
  targetUser: { type: mongoose.Types.ObjectId, ref: 'User', required: false },
  title : { type: String, required: true },
  message: { type: String, required: true },
  bookingId : { type: mongoose.Types.ObjectId, ref: 'Booking', required: false },
  type: { type: String, required: true },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });


module.exports = mongoose.model('Notification', notificationSchema);
