const { default: status } = require("http-status");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");
const { addEmployerService, editEmployerService, deleteEmployerService, getEmployerService, getAllEmployerService, suspendEmployerService, activeEmployerService, flagEmployerService, allocateCreditEmployerService, noteToEmployerService } = require("./employer.service");
const { is } = require("date-fns/locale");



const addEmployerController = catchAsync(async (req, res) => {
  const newEmployer = await addEmployerService(req.body);
  return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Employer", message: "Employer added successfully", data: newEmployer, }));
})


const editEmployerController = catchAsync(async (req, res) => {
  const result = await editEmployerService(req.params.id, req.body);
  return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employer", message: "Employer edited successfully", data: result, }));
})


const deleteEmployerController = catchAsync(async (req, res) => {
  const result = await deleteEmployerService(req.params.id, req.User._id);
  return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employer", message: "Employer deleted successfully", data: result, }));
})


const suspendEmployerController = catchAsync(async (req, res) => {
  const result = await suspendEmployerService(req.params.id, req.User._id);
  return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employer", message: "Employer suspended successfully", data: result, }));
})

const flagEmployerController = catchAsync(async (req, res) => {
  const result = await flagEmployerService(req.params.employerId, req.User._id);
  return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employer", message: "Employer flaged successfully", data: result, }));
})

const noteToEmployerController = catchAsync(async (req, res) => {
  req.body.performedBy = req.User._id;
  const result = await noteToEmployerService(req.params.employerId, req.body);
  return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employer", message: "Employer flaged successfully", data: result, }));
})


const allocateCreditEmployerController = catchAsync(async (req, res) => {
  req.body.performedBy = req.User._id;
  const result = await allocateCreditEmployerService(req.params.employerId, req.body)
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Employer",
    message: "credit allocated successfully", data: result
  }));
})

const activeEmployerController = catchAsync(async (req, res) => {
  const result = await activeEmployerService(req.params.id, req.User._id);
  return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employer", message: "Employer active successfully", data: result, }));
})

const getEmployerController = catchAsync(async (req, res) => {
  const result = await getEmployerService(req.params.id);
  return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Employer", message: "Employer fetched successfully", data: result, }));
})


const getAllEmployerController = catchAsync(async (req, res) => {
  const options = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10
  };

  let filter = {};
  if (req.query.search) {
    const search = req.query.search;

    filter.$or = [
      { contactName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { industry: { $regex: search, $options: "i" } },
      { companyName: { $regex: search, $options: "i" } }
    ];
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const result = await getAllEmployerService(options, filter);

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "Employer",
      message: "Employer fetched successfully",
      data: result
    })
  );
});


module.exports = {
  addEmployerController, editEmployerController, deleteEmployerController, getEmployerController,
  getAllEmployerController, suspendEmployerController, activeEmployerController, flagEmployerController,
  allocateCreditEmployerController,noteToEmployerController
}