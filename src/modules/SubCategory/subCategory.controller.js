const { status } = require("http-status");
const response = require("../../helpers/response");
const catchAsync = require("../../helpers/catchAsync");
const { editSubCategoryService, addSubCategoryService, deleteSubCategoryService, getAllSubCategoryService } = require("./subCategory.service");


const addSubCategoryController = catchAsync(async (req, res) => {
    if(req.file){
        req.body.image = `/uploads/SubCategory/${req.file.filename}`;
    }
    req.body.performedBy = req.User._id;
    const newSubCategory = await addSubCategoryService(req.body);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "SubCategory", message: "SubCategory added successfully", data: newSubCategory, }));
})

const editSubCategoryController = catchAsync(async (req, res) => {
    if(req.file){
        req.body.image = `/uploads/SubCategory/${req.file.filename}`;
    }
    req.body.performedBy = req.User._id;
    const result = await editSubCategoryService(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK,
         type: "SubCategory", message: "SubCategory edited successfully", data: result, }));
})

const deleteSubCategoryController = catchAsync(async (req, res) => {
    req.body.performedBy = req.User._id;
    const result = await deleteSubCategoryService(req.params.id);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "SubCategory", message: "SubCategory deleted successfully", data: result, }));
})


const getAllSubCategoryByCategoryController = catchAsync(async (req, res) => {
    option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    }
    const result = await getAllSubCategoryService(req.params.category,option);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "SubCategory", message: "SubCategory fetched successfully", data: result, }));
})



module.exports = {
    addSubCategoryController,
    editSubCategoryController,
    deleteSubCategoryController,
    getAllSubCategoryByCategoryController
}