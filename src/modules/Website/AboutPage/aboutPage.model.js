const mongoose = require('mongoose');

const aboutPageSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true
    },
    appLink: {
        type: String,
        required: true
    },
    ourValues: [{
        icon: {
            type: String,
            required: true
        },
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        }
    }],
    bookingMade: {
        type: Number,
        required: true
    },
    verifiedPartners: {
        type: Number,
        required: true
    },
    avgRating: {
        type: Number,
        required: true
    },
    citiesLanchingYear: {
        type: Number,
        required: true
    },
    citiesLanchingCount: {
        type: Number,
        required: true
    }

}, { timestamps: true });

const AboutPage = mongoose.model('AboutPage', aboutPageSchema);

module.exports = AboutPage;