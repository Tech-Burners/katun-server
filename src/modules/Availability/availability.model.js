const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    slot: [
        {
            startTime: { type: Date, required: true },
            endTime: { type: Date, required: true },
            capacity: { type: Number, default: 1, min: 1 }
        }
    ],
}, { timestamps: true });


module.exports = mongoose.model('Availability', availabilitySchema);