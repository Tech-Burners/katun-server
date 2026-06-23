const mongoose = require("mongoose");


const feedbackSchema = new mongoose.Schema({
   sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
   targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
   service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: false },
   booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: false },
   isAppFeedback: { type: Boolean, default: false },
   rating: { type: Number, required: false },
   text: { type: String, required: false }
},
   { timestamps: true }
);



module.exports = mongoose.model('Feedback', feedbackSchema); 