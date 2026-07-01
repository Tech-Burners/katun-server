const response = require("../../helpers/response");
const catchAsync = require("../../helpers/catchAsync");
const { default: status } = require("http-status");
const { addDepartmentService, getDepartmentService, updateDepartmentService, deleteDepartmentService } = require("./department.service");


const addDepartmentController = catchAsync(async (req, res) => {
    console.log("req.User", req.User)
    req.body.loginUser = req.User._id
    console.log("req.body", req.body)
    const newDepartment = await addDepartmentService(req.body);

    return res.status(status.OK).json(
        response({
            status: "success",
            statusCode: status.OK,
            message: "Department added successfully",
            data: newDepartment,
        })
    );
});


const getDepartmentController = catchAsync(async (req, res) => {

    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search || ""
    };

    const department = await getDepartmentService(options, req.User._id, req.User.role);

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            message: "Department fetched successfully",
            data: department
        })
    );
});


const updateDepartmentController = catchAsync(async (req, res) => {
    const Department = await updateDepartmentService(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, message: "Department updated successfully", data: Department, }));
})


const deleteDepartmentController = catchAsync(async (req, res) => {
    const Department = await deleteDepartmentService(req.params.id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, message: "Department deleted successfully", data: Department, }));
})


module.exports = { addDepartmentController, getDepartmentController, updateDepartmentController, deleteDepartmentController }