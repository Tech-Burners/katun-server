const { default: status } = require("http-status");
const { editCommissionService, deleteCommissionService, getAllCommissionService } = require("./commission.service");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");

const editCommissionController = catchAsync(async (req, res) => {
    const result = await editCommissionService(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Commission", message: "Commission edited successfully", data: result, }));
})

const deleteCommissionController = catchAsync(async (req, res) => {
    const result = await deleteCommissionService(req.params.id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Commission", message: "Commission deleted successfully", data: result, }));
})


const getAllCommissionController = catchAsync(async (req, res) => {
    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    }
    const result = await getAllCommissionService(option);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Commission", message: "Commission fetched successfully", data: result, }));
})

module.exports = {  editCommissionController, deleteCommissionController, getAllCommissionController }

