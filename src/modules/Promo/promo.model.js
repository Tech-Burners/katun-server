const mongoose = require("mongoose");

const promoSchema = new mongoose.Schema({
    code : { type: String, required: false },
    name : { type: String, required: false },
    description : { type: String, required: false },
    discount : { type: Number, required: false },
    minspend : { type: Number, required: false },
    usageLimit : { type: Number, required: false },
    validForm : { type: Date, required: false },
    validTo : { type: Date, required: false },    
    eligiblity : { type: String, enum: ['all-users', 'new-users', 'employees'], required: false },
    status: { type: String, enum : ['active', 'paused', 'expired', 'scheduled'], default: 'active' },
    image: { type: String, required: false },
    createdBy : { type: String, required: true, enum: ['admin', 'partner'] },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });


module.exports = mongoose.model("Promo", promoSchema);