// allocationManagement.model.js

const mongoose = require("mongoose");

const allocationManagementSchema = new mongoose.Schema({

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    allocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Allocate',
        required: true
    },

    totalCredit: { type: Number, default: 0 },
    usedCredit: { type: Number, default: 0 },
    remainingCredit: { type: Number, default: 0 },

    periodStart: Date,
    periodEnd: Date,

    status: {
        type: String,
        enum: ['active', 'expired', 'paused'],
        default: 'active'
    }

}, { timestamps: true });

module.exports = mongoose.model(
    "AllocationManagement",
    allocationManagementSchema
);