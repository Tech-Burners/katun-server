const { default: status } = require("http-status");
const catchAsync = require("../../helpers/catchAsync");
const { deleteStuff, updateStuff, getStuff, addStuff } = require("./staffs.service");
const response = require("../../helpers/response");



const addStuffController = catchAsync(async (req, res) => {
    const newStuff = await addStuff(req.body);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Stuff", message: "Stuff added successfully", data: newStuff, }));
})


const getAllStuffController = catchAsync(async (req, res) => {
    const result = await getStuff();
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Stuff", message: "Stuff fetched successfully", data: result, }));
})


const deleteStuffController = catchAsync(async (req, res) => {
    const result = await updateStuff(req.params.id, { isDeleted: true });
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Stuff", message: "Stuff deleted successfully", data: result, }));
})

const editStuffController = catchAsync(async (req, res) => {
    const result = await updateStuff(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Stuff", message: "Stuff edited successfully", data: result, }));
})


module.exports = { addStuffController, getAllStuffController, deleteStuffController, editStuffController }