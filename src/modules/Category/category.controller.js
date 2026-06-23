const { addCategoryService, editCategoryService, deleteCategoryService, getAllCategoryService } = require("./category.service");
const { status } = require("http-status");
const response = require("../../helpers/response");
const catchAsync = require("../../helpers/catchAsync");


const addCategoryController = catchAsync(async (req, res) => {
    if(req.file){
        req.body.image = `/uploads/category/${req.file.filename}`;
    }
    req.body.performedBy = req.User._id;
    const newCategory = await addCategoryService(req.body);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Category", message: "Category added successfully", data: newCategory, }));
})

const editCategoryController = catchAsync(async (req, res) => {
    if(req.file){
        req.body.image = `/uploads/category/${req.file.filename}`;
    }
    req.body.performedBy = req.User._id;
    const result = await editCategoryService(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Category", message: "Category edited successfully", data: result, }));
})

const deleteCategoryController = catchAsync(async (req, res) => {
    req.body.performedBy = req.User._id;
    const result = await deleteCategoryService(req.params.id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Category", message: "Category deleted successfully", data: result, }));
})


const getAllCategoryController = catchAsync(async (req, res) => {
    option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    }
    const result = await getAllCategoryService(option);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Category", message: "Category fetched successfully", data: result, }));
})



module.exports = {
    addCategoryController,
    editCategoryController,
    deleteCategoryController,
    getAllCategoryController
}