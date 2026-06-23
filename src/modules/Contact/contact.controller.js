const { default: status } = require("http-status");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");
const sendContactService = require("./contact.service");


const sendContactController = catchAsync(async (req, res) => {
    const result = await sendContactService(req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Contact", message: "Contact added successfully", data: result, }));
});

module.exports = {
    sendContactController
}