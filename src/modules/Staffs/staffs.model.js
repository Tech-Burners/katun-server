const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    name: { type: String, required: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false },
},
    {
        timestamps: true
    });

staffSchema.index({ partnerId: 1, isDeleted: 1 });
staffSchema.index({ partnerId: 1, name: 1 });

module.exports = mongoose.model('Staff', staffSchema);