const { status } = require("http-status");
const { addFQService, allFQ, editFQService, deleteFQService } = require("./fq.service");
const response = require("../../helpers/response");
const catchAsync = require("../../helpers/catchAsync");

const addFQ = catchAsync(async (req, res) => {
    const newFQ = await addFQService(req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.CREATED, type: "F&Q", message: "F&Q added successfully", data: newFQ, }));
})

const getallFQ = catchAsync(async(req, res)=>{
    console.log("Hi")
})

const editFQ = catchAsync(async (req, res) => {
    const newFQ = await editFQService(req.params.id, req.body);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.OK, type: "F&Q", message: "F&Q edited successfully", data: newFQ, }));

})

const deleteFQ = catchAsync(async (req, res) => {
    const newFQ = await deleteFQService(req.params.id);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.OK, type: "F&Q", message: "F&Q edited successfully", data: newFQ, }));

})


const getFQ = catchAsync(async (req, res) => {
    console.log("hiiiii")
    const options = {
        page: Number(req.query.page || 1),
        limit : Number(req.query.limit || 10)
    }
    const FQ = await allFQ(options);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "F&Q", message: "F&Q fetched successfully", data: FQ, }));
})

module.exports = { addFQ,getallFQ, editFQ, deleteFQ, getFQ }