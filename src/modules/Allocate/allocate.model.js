const mongoose = require("mongoose");

const allocateSchema = new mongoose.Schema({
    name: { type: String,  required: true },
    allocateTo: { type: String,enum: ['all-employee', 'branch', 'department'], required: true },
    creditPrgram: { type: String, required: false },
    creditPerEmployee: { type: Number, required: false },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: false },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: false },
    frequency: { type: Number, required: false },
    startDate: { type: Date, required: false },
    expireDate: { type: Date, required: false },
    isRecurring: { type: Boolean, default: false },
    status : { type: String, enum: ['active', 'paused'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model("Allocate", allocateSchema);