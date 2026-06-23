const mongoose = require("mongoose");

const bankSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bank_name: { type: String, required: true },
    account_name: { type: String, default: false },
    account_number: { type: String, required: true },
    bankNotListed: { type: Boolean, default: false },
    isManual: { type: Boolean, default: false },
},
    {
        timestamps: true
    });

module.exports = mongoose.model('Bank', bankSchema);