const { addBankService, getBankService, deleteBankService, addbankService, getMybankService, editbankService, upsertBankService, getAllRequestedbankService } = require("./bank.service");
const { status } = require("http-status");
const response = require("../../helpers/response");
const catchAsync = require("../../helpers/catchAsync");
const { getAllbankService } = require("./bank.service");

const addBankController = catchAsync(async (req, res) => {
    req.body.user = req.User._id;
    const newBank = await upsertBankService(req.body);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Bank", message: "Bank added successfully", data: newBank, }));
})



const getMybankController = catchAsync(async (req, res) => {
    const result = await getMybankService(req.User._id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Bank", message: "Bank fetched successfully", data: result, }));
})

const getAllRequestedbankController = catchAsync(async (req, res) => {
    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    }
    const result = await getAllRequestedbankService(options);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Bank", message: "Bank fetched successfully", data: result, }));
})

const deleteBankController = catchAsync(async (req, res) => {
    const result = await deleteBankService(req.params.id);
    if (result) return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Bank", message: "Bank deleted successfully" }));
    else return res.status(status.BAD_REQUEST).json(response({ status: 'error', statusCode: status.BAD_REQUEST, type: "Bank", message: "Bank delete failed" }));
})


module.exports = { addBankController, getMybankController, getAllRequestedbankController, deleteBankController }