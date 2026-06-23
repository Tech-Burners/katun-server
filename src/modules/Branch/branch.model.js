const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
    employer: { type: mongoose.Schema.Types.ObjectId, ref: 'Employer', required: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    location: {
        type: { type: String, enum: ["Point"] },
        coordinates: { type: [Number] },
    },
    isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

branchSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('branch', branchSchema);