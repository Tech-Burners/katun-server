const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    bookingId: {
        type: String,
        unique: true,
        index: true
    },

    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },

    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    date: { type: Date },
    startTime: { type: Date },
    endTime: { type: Date },
    servicePrice: { type: Number },
    totalPrice: { type: Number },
    addons: [
        {
            serviceName: { type: String, required: false },
            price: { type: Number, required: false }
        }
    ],
    pass: {
        passName: { type: String, required: false },
        price: { type: Number, required: false },
        noOfSessions: { type: Number, required: false },
        validity: { type: Number, required: false },
    },
    tips : { type: Number, required: false },
    paymentMethod: { type: String, enum: ['card','banktransfer', 'cash', 'wallet'] },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
    status: { type: String, enum: ['pending', 'approved', 'cancelled', 'completed'], default: 'pending' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    reason: { type: String, required: false },
    pin: { type: String, required: false },
    checkin: { type: Date, required: false },
    // review: { type: String, required: false },
    // rating: { type: Number, required: false },
    isOneTime: { type: Boolean, default: false },
    sessionLeft: { type: Number, required: false },
    expireDate: { type: Date, required: false },
}, { timestamps: true });

bookingSchema.pre('save', async function (next) {

    if (!this.bookingId) {

        const random = Math.floor(1000 + Math.random() * 9000);

        const count = await mongoose.model('Booking').countDocuments();

        // take last 6 digits of timestamp
        const shortTime = Date.now().toString().slice(-6);

        this.bookingId = `BK-${shortTime}-${count + 1}-${random}`;
    }

    next();
});
module.exports = mongoose.model('Booking', bookingSchema);