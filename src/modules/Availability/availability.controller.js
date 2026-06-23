const { default: status } = require("http-status");
const catchAsync = require("../../helpers/catchAsync");
const { addAvailabilityService, editAvailabilityService, deleteAvailabilityService, availabilityForAServiceService } = require("./availability.service");
const response = require("../../helpers/response");

const addAvailabilityController = catchAsync(async (req, res) => {
    const newAvailability = await addAvailabilityService(req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, message: "Availability added successfully", data: newAvailability, }));
})

const editAvailabilityController = catchAsync(async (req, res) => {
    const result = await editAvailabilityService(req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, message: "Availability edited successfully", data: result, }));
})

const deleteAvailabilityController = catchAsync(async (req, res) => {
    const result = await deleteAvailabilityService(req.params.id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, message: "Availability deleted successfully", data: result, }));
})

const availabilityForAServiceController = catchAsync(async (req, res) => {
    const result = await availabilityForAServiceService(req.params.id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, message: "Availability fetched successfully", data: result, }));
})


module.exports = { addAvailabilityController, editAvailabilityController, deleteAvailabilityController,availabilityForAServiceController }