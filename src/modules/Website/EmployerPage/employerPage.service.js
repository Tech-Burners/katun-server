const EmployerPage = require("./employerPage.model");

const updateEmployerPageService = async (EmployerPageData) => {
    return EmployerPage.findOneAndUpdate({}, EmployerPageData, { new: true, upsert: true });
}


const getEmployerPageService = async () => {
    return EmployerPage.findOne({});
}

module.exports = {
    updateEmployerPageService,
    getEmployerPageService
}