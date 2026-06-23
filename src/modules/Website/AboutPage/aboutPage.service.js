const AboutPage = require("./aboutPage.model");


const updateAboutPageService = async (AboutPageData) => {
    return AboutPage.findOneAndUpdate({}, AboutPageData, { new: true, upsert: true });
}


const getAboutPageService = async () => {
    return AboutPage.findOne({});
}


module.exports = {
    updateAboutPageService,
    getAboutPageService
}