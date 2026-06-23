const { default: status } = require("http-status");
const { addPromoService, editPromoService, deletePromoService, getPromoService, getPartnerPromoService, getAdminPromoService } = require("./promo.service");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");


const addPromoController = catchAsync(async (req, res) => {
    if(req.file) req.body.image = `/uploads/promo/${req.file.filename}`;
    req.body.user = req.User._id;
    req.body.createdBy = req.User.role;
    const newPromo = await addPromoService(req.body);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Promo", message: "Promo added successfully", data: newPromo, }));
})

const editPromoController = catchAsync(async (req, res) => {
    if(req.file) req.body.image = `/uploads/promo/${req.file.filename}`
    const result = await editPromoService(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Promo", message: "Promo edited successfully", data: result, }));
})

const deletePromoController = catchAsync(async (req, res) => {
    const result = await deletePromoService(req.params.id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Promo", message: "Promo deleted successfully", data: result, }));
})

const getPartnerPromoController = catchAsync(async (req, res) => {
    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    }
    const result = await getPartnerPromoService(req.User._id, option);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Promo", message: "Promo fetched successfully", data: result, }));
})

const getAdminPromoController = catchAsync(async (req, res) => {
    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    }
    const result = await getAdminPromoService(option);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Promo", message: "Promo fetched successfully", data: result, }));
})


module.exports = { addPromoController, editPromoController, deletePromoController , getPartnerPromoController, getAdminPromoController}