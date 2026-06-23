const mongoose = require("mongoose");

const localizedStringSchema = new mongoose.Schema({
  en: { type: String, required: false },
  es: { type: String, required: false }
}, { _id: false });

const notificationSchema = new mongoose.Schema({
  sender: { type: mongoose.Types.ObjectId, ref: 'User', required: false },
  targetUser: { type: mongoose.Types.ObjectId, ref: 'User', required: false },
  message: { type: localizedStringSchema, required: true },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });


module.exports = mongoose.model('Notification', notificationSchema);
