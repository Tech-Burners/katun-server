const { default: status } = require("http-status");
const catchAsync = require("../../helpers/catchAsync");
const { addAdminService, allAdminService, editAdminService, deleteAdminService, suspendAdminService, activateAdminService } = require("./admin.service");
const response = require("../../helpers/response");
const ApiError = require("../../helpers/ApiError");
const { getUserByEmail } = require("../Auth/auth.service");
const employerModel = require("../Employer/employer.model");


const addAdminController = catchAsync(async (req, res) => {
    const { email } = req.body;
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
        throw new ApiError(status.CONFLICT, 'This email is already used!');
    }
    req.body.createdBy = req.User._id;
    req.body.loginUser = req.User._id;
    const result = await addAdminService(req.body);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, message: 'employee_added', type: 'admin', data: result }))
})


const editAdminController = catchAsync(async (req, res) => {
    const result = await editAdminService(req.params.userId, req.body);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, message: 'admin edited', type: 'admin', data: result }))
})


const deleteAdminController = catchAsync(async (req, res) => {
    const result = await deleteAdminService(req.params.userId);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, message: 'admin deleted', type: 'admin', data: result }))
})


const allAdminController = catchAsync(async (req, res) => {
    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    }
    let filter = { isSupperAdmin: { $ne: true } };

    if (req.User.role === "hr" || req.User.role === "sub_hr_admin") {
        const company = await employerModel.findOne({
            user: { $in: [req.User._id] },
            isDeleted: false
        });

        if (company) {
            // Filter admins whose user is part of this company's user list
            filter = {
                user: { $in: company.user },
                isSupperAdmin: { $ne: true }
            };
        } else {
            // No company found for this user, return empty results
            filter = { _id: null };
        }
    }

    const result = await allAdminService(options, filter);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, message: 'all_employees', type: 'admin', data: result }))
})


const allAdminWithMainAdminController = catchAsync(async (req, res) => {
    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    }
    let filter = {};
    const result = await allAdminService(options, filter);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, message: 'all_employees', type: 'admin', data: result }))
})


const suspendAdminController = catchAsync(async (req, res) => {
    const result = await suspendAdminService(req.params.userId);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, message: 'admin suspended', type: 'admin', data: result }))
})


const activateAdminController = catchAsync(async (req, res) => {
    const result = await activateAdminService(req.params.userId);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, message: 'admin activated', type: 'admin', data: result }))
})



module.exports = {
    addAdminController,
    editAdminController,
    deleteAdminController,
    allAdminController,
    suspendAdminController,
    activateAdminController,
    allAdminWithMainAdminController
}
