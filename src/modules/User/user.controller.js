const { default: status } = require("http-status");
const catchAsync = require("../../helpers/catchAsync");
const { suspendUserService, activeUserService, giveFlagService, giveNoteService, giveCreditService } = require("./user.service");
const response = require("../../helpers/response");
const { checkServiceAvailabilityService } = require("../Service/service.service");

const suspendUserController = catchAsync(async (req, res) => {
  const result = await suspendUserService(req.params.id);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "User", message: "User suspended successfully", data: {name : result.fullName}
  }));
})

const activeUserController = catchAsync(async (req, res) => {
  const result = await activeUserService(req.params.id);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "User", message: "User activated successfully", data: {name : result.fullName}
  }));
})

const addFlagController = catchAsync(async (req, res) => {
  await giveFlagService(req.params.id);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "User", message: "one flag added"
  }));
})

const addNoteController = catchAsync(async (req, res) => {
  await giveNoteService(req.params.id, req.body.note);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "User", message: "note added"
  }));
})


const addCreditController = catchAsync(async (req, res) => {
  await giveCreditService(req.params.id, req.body.credit);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "User", message: "credit added"
  }));
})

const checkServiceAvailability = catchAsync(async (req, res) => {
  const result = await checkServiceAvailabilityService(req.User._id);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Service", message: "Service is available", data: result
  }));
})

module.exports = {
  suspendUserController,
  addFlagController,
  addNoteController,
  activeUserController,
  addCreditController,
  checkServiceAvailability
}