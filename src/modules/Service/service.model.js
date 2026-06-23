const mongoose = require('mongoose');


const serviceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, required: false },
    duration: { type: Number, required: false },
    servicefee: { type: Number, required: false },
    included: [{ type: String, required: false }],
    image: { type: String, required: false },
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
    totalRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0, set: v => Math.round(v * 100) / 100 },
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    sell : { type: Number, default: 0 },
}, { timestamps: true });


module.exports = mongoose.model('Service', serviceSchema);