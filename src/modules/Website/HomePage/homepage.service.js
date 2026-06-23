const HomePage = require("./homepage.model")

const updateHomePageService = async (homePageData) => {
    return HomePage.findOneAndUpdate({}, homePageData, { new: true, upsert: true });
}

const getHomePageService = async () => {
    return HomePage.findOne({});
}

module.exports = {
    updateHomePageService,
    getHomePageService
}