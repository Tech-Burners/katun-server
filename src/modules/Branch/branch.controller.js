const response = require("../../helpers/response");
const { addBranchService, getBranchService, updateBranchService, deleteBranchService } = require("./branch.service");
const catchAsync = require("../../helpers/catchAsync");
const { default: status } = require("http-status");


const addBranchController = catchAsync(async (req, res) => {
    req.body.loginUser = req.User._id
    const newBranch = await addBranchService(req.body);

    return res.status(status.OK).json(
        response({
            status: "success",
            statusCode: status.OK,
            message: "Branch added successfully",
            data: newBranch,
        })
    );
});


const getBranchController = catchAsync(async (req, res) => {

    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search || ''
    };

    const branch = await getBranchService(options, req.User._id);

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            message: "Branch fetched successfully",
            data: branch
        })
    );
});



const updateBranchController = catchAsync(async (req, res) => {
    const branch = await updateBranchService(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, message: "Branch updated successfully", data: branch, }));
})

const deleteBranchController = catchAsync(async (req, res) => {
    const branch = await deleteBranchService(req.params.id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, message: "Branch deleted successfully", data: branch, }));
})


module.exports = { addBranchController, getBranchController, updateBranchController, deleteBranchController }