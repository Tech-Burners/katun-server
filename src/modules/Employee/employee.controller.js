const { editEmployeeService, getCompanyAllEmployeeService,
    suspendEmployeeService, activeEmployeeService,
    flagEmployeeService,
    allocateCreditEmployeeService,
    addNoteService } = require("./employee.service");
const { addEmployeeService, getEmployeeService,
    getAllEmployeeService, deleteEmployeeService } = require("./employee.service");
const { status } = require("http-status");
const response = require("../../helpers/response");
const catchAsync = require("../../helpers/catchAsync");
const adminModel = require("../Admin/admin.model");
const employerModel = require("../Employer/employer.model");



const addEmployeeController = catchAsync(async (req, res) => {

    let company;

    // ✅ Sub HR Admin
    if (req.User.role === 'sub_hr_admin') {

        const parentAdmin = await adminModel.findOne({
            user: req.User._id
        });

        if (!parentAdmin) {
            throw new ApiError(404, 'Parent admin not found');
        }

        company = await employerModel.findOne({
            user: parentAdmin.parent
        });

    } 
    // ✅ Main Employer / Company Admin
    else {

        company = await employerModel.findOne({
            user: req.User._id
        });

    }

    if (!company) {
        throw new ApiError(404, 'Company not found');
    }

    req.body.company = company._id;

    const newEmployee = await addEmployeeService(req.body);

    return res.status(status.CREATED).json(
        response({
            status: 'success',
            statusCode: status.CREATED,
            type: "Employee",
            message: "Employee added successfully",
            data: newEmployee,
        })
    );
});



const getEmployeeController = catchAsync(async (req, res) => {
    const result = await getEmployeeService(req.params.id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employee", message: "Employee fetched successfully", data: result, }));
})

const getAllEmployeeController = catchAsync(async (req, res) => {

    const {
        page,
        limit,
        search,
        department,
        branch,
        status: employeeStatus,
        company
    } = req.query;

    const option = {
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        search,
        department,
        branch,
        status: employeeStatus,
        company
    };

    const result = await getAllEmployeeService(option);

    console.log({ result });

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            type: "Employee",
            message: "Employee fetched successfully",
            data: result
        })
    );
});

const getCompanyAllEmployeeController = catchAsync(async (req, res) => {

    const {
        page,
        limit,
        search,
        department,
        branch,
        status: employeeStatus
    } = req.query;

    const option = {
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        search,
        department,
        branch,
        status: employeeStatus
    };

    const result = await getCompanyAllEmployeeService(req.User._id, option);

    console.log({ result });

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            type: "Employee",
            message: "Employee fetched successfully",
            data: result
        })
    );
});

const editEmployeeController = catchAsync(async (req, res) => {
    const result = await editEmployeeService(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employee", message: "Employee edited successfully", data: result, }));
})

const flagEmployeeController = catchAsync(async (req, res) => {
    const result = await flagEmployeeService(req.params.id, req.User._id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employee", message: "Employee flaged successfully", data: result, }));
})

const allocateCreditEmployeeController = catchAsync(async (req, res) => {
    req.body.performedBy = req.User._id;
    req.body.role = req.User.role;
    const result = await allocateCreditEmployeeService(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employee", message: "Employee flaged successfully", data: result, }));
})

const addNoteController = catchAsync(async (req, res) => {
    req.body.performedBy = req.User._id;
    const result = await addNoteService(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employee", message: "Employee note successfully", data: result, }));
})

const suspendEmployeeController = catchAsync(async (req, res) => {
    const result = await suspendEmployeeService(req.params.id, req.User._id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employee", message: "Employee suspended successfully", data: result, }));
})

const activeEmployeeController = catchAsync(async (req, res) => {
    const result = await activeEmployeeService(req.params.id, req.User._id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employee", message: "Employee activated successfully", data: result, }));
})



const deleteEmployeeController = catchAsync(async (req, res) => {
    const result = await deleteEmployeeService(req.params.id, req.User._id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employee", message: "Employee deleted successfully", data: result, }));
})

module.exports = {
    addEmployeeController,
    getEmployeeController,
    getAllEmployeeController,
    editEmployeeController,
    deleteEmployeeController,
    activeEmployeeController,
    suspendEmployeeController,
    getCompanyAllEmployeeController,
    flagEmployeeController,
    allocateCreditEmployeeController,
    addNoteController
}