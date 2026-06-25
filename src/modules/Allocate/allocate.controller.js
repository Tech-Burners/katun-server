const { default: status } = require("http-status");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");
const { editAllocateService, deleteAllocateService, getAllocateByIdService, addAllocatedService, getAllAllocateService, pauseUnpauseAllocateService } = require("./allocate.service");
const employerModel = require("../Employer/employer.model");


const addAllocateController = catchAsync(async (req, res) => {
    req.body.user = req.User._id
    req.body.role = req.User.role
    const allocate = await addAllocatedService(req.body);
    return res.status(status.CREATED).json(response({ status: 'Success', statusCode: status.CREATED, type: 'allocate', message: 'allocate-added', data: allocate }));
});

const editAllocateController = catchAsync(async (req, res) => {
    const allocate = await editAllocateService(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'allocate', message: 'allocate-edited', data: allocate }));
});

const deleteAllocateController = catchAsync(async (req, res) => {
    const allocate = await deleteAllocateService(req.params.id);
    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'allocate', message: 'allocate-deleted', data: allocate }));
});


const pauseUnpauseAllocateController = catchAsync(async (req, res) => {
    const allocate = await pauseUnpauseAllocateService(req.params.id);
    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'allocate', message: 'allocate-paused', data: allocate }));
})


const getAllAllocateController = catchAsync(async (req, res) => {
    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    };

    const filters = {};

    // Role based filtering
    if (req.User.role === "hr") {
        const company = await employerModel.findOne({ user: req.User._id });
        // HR can only see allocations for their company
        filters.companyId =company._id;
    }

    if (
        req.User.role === "admin" ||
        req.User.role === "sub_hr_admin"
    ) {
        // Admin and Sub HR Admin can only see admin-created allocations
        filters.isCreatedByAdmin = true;
    }

    // Search filter
    if (req.query.search) {
        const searchRegex = { $regex: req.query.search, $options: 'i' };
        filters.$or = [
            { name: searchRegex },
            { allocateTo: searchRegex }
        ];
    }

    if (req.query.allocateTo) {
        filters.allocateTo = req.query.allocateTo;
    }

    const allocate = await getAllAllocateService(options, filters);

    return res.status(status.OK).json(
        response({
            status: 'Success',
            statusCode: status.OK,
            type: 'allocate',
            message: 'allocate-found',
            data: allocate
        })
    );
});


const getAllocateByIdController = catchAsync(async (req, res) => {
    const allocate = await pauseUnpauseAllocateService(req.params.id);
    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'allocate', message: 'allocate-found', data: allocate }));
});


module.exports = {
    addAllocateController,
    editAllocateController,
    deleteAllocateController,
    getAllAllocateController,
    getAllocateByIdController,
    pauseUnpauseAllocateController
}