const PartnerPage = require("./partner.model");


const updatePartnerPageService = async (PartnerPageData) => {
    return PartnerPage.findOneAndUpdate({}, PartnerPageData, { new: true, upsert: true });
}

const getPartnerPageService = async () => {
    return PartnerPage.findOne({});
}

module.exports = {
    updatePartnerPageService,
    getPartnerPageService
}