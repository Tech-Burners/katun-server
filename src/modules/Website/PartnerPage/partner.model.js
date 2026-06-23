const mongoose = require('mongoose');

const PartnerPageSchema = new mongoose.Schema({
    bannerImage: { type: String, required: false },
    url: { type: String, required: false },
    title: { type: String, required: false },
    subtitle: { type: String, required: false },
    AppLink: { type: String, required: false },
    howItWorks: [
        {
            icon: { type: String, required: false },
            title: { type: String, required: false },
            description: { type: String, required: false },
        }
    ],
    whyAuravive: [
        {
            title: { type: String, required: false }, 
        }
    ]
}, { timestamps: true });

const PartnerPage = mongoose.model('PartnerPage', PartnerPageSchema);
module.exports = PartnerPage;