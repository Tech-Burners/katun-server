const mongoose = require('mongoose');

const HomePageSchema = new mongoose.Schema({
    titleLine1: { type: String, required: true },
    titleLine2: { type: String, required: false },
    subtitle: { type: String, required: false },
    heroImage: { type: String, required: false },
    verifiedProviderCount: { type: Number, default: 0 },
    totalBookingCount: { type: Number, default: 0 },
    saleCount: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    serviceIcon: { type: String, required: false },
    serviceName: { type: String, required: false },
}, { timestamps: true });

const HomePage = mongoose.model('HomePage', HomePageSchema);

module.exports = HomePage;