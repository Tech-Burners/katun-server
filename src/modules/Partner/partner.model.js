const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
    businessName: { type: String, required: false },
    bankStatement: { type: String, required: false },
    businessCertification: { type: String, required: false },
    identityProof: { type: String, required: false },
    certificate: { type: String, required: false },
    aboutUs: { type: String, required: false },
    amenities: [{ type: String, required: false }],
    // location: {
    //     type: { type: String, enum: ["Point"] },
    //     coordinates: { type: [Number] },           
    // },
    totalBookings: { type: Number, default: 0 },
    completeBookings: { type: Number, default: 0 },
    // reportCount: { type: Number, default: 0 },
    // flagCount: { type: Number, default: 0 },
    note: { type: String, required: false },
    isVerified: { type: Boolean, default: false },
    isCertified: { type: Boolean, default: false },
    isBan : { type: Boolean, default: false },
    address: { type: String, required: false },
    rating: { type: Number, required: false }, //avg rating
    totalRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    review: { type: String, required: false },
    isDeleted: { type: Boolean, default: false },
    serviceAutoApproved: { type: Boolean, default: false },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: false },
    subcategory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubCategory', required: false }],
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// partnerSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('partner', partnerSchema);