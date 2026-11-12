const { default: status } = require("http-status");
const {
    addPromoService,
    editPromoService,
    deletePromoService,
    getPromoService,
    getPartnerPromoService,
    getAdminPromoService,
    getCouponsByPartnerService,
    verifyCouponService,
} = require("./promo.service");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");


const addPromoController = catchAsync(async (req, res) => {
    if(req.file) req.body.image = `/uploads/promo/${req.file.filename}`;
    req.body.user = req.User._id;
    req.body.createdBy = ['admin', 'sub_admin'].includes(req.User.role) ? 'admin' : req.User.role;

    // Normalize field names from Partner Mobile App
    if (!req.body.name && req.body.title) req.body.name = req.body.title;
    if (req.body.discountValue !== undefined && req.body.discount === undefined) req.body.discount = req.body.discountValue;
    if (req.body.minimumSpend !== undefined && req.body.minspend === undefined) req.body.minspend = req.body.minimumSpend;
    if (!req.body.validTo && req.body.expirationDate) req.body.validTo = req.body.expirationDate;

    // Auto-generate promo code if not provided
    if (!req.body.code) {
        req.body.code = `PROMO${Math.floor(100000 + Math.random() * 900000)}`;
    }

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

const getCouponsByPartnerController = catchAsync(async (req, res) => {
    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        status: req.query.status,
        search: req.query.search,
    };
    const result = await getCouponsByPartnerService(req.params.partnerId, option);
    return res.status(status.OK).json(
        response({
            status: "success",
            statusCode: status.OK,
            type: "Promo",
            message: "Partner coupons fetched successfully",
            data: result,
        })
    );
});

const verifyCouponController = catchAsync(async (req, res) => {
    const code = req.body?.code || req.body?.coupon || req.body?.couponCode || req.query?.code;
    const partnerId =
        req.body?.partner ||
        req.body?.partnerId ||
        req.body?.provider ||
        req.query?.partnerId ||
        req.query?.partner;
    const amount =
        req.body?.amount !== undefined
            ? req.body?.amount
            : req.body?.totalPrice !== undefined
            ? req.body?.totalPrice
            : req.body?.servicePrice !== undefined
            ? req.body?.servicePrice
            : req.query?.amount;

    const result = await verifyCouponService({
        code,
        partnerId,
        amount,
    });

    return res.status(status.OK).json(
        response({
            status: "success",
            statusCode: status.OK,
            type: "Promo",
            message: "Coupon verified successfully",
            data: result,
        })
    );
});

module.exports = {
    addPromoController,
    editPromoController,
    deletePromoController,
    getPartnerPromoController,
    getAdminPromoController,
    getCouponsByPartnerController,
    verifyCouponController,
};