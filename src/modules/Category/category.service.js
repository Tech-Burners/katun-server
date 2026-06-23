const { default: mongoose } = require("mongoose");
const commissionModel = require("../Commission/commission.model");
const categoryModel = require("./category.model");
const { addAuditReport } = require("../Audit/audit.service");


const addCategoryService = async (data) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const [cat] = await categoryModel.create([data], { session });
        await commissionModel.create(
            [{ category: cat._id, commission: 0 }],
            { session }
        );
        await addAuditReport({
            action: "Add",
            summary: `Category ${cat.name} added`,
            performedBy: data.performedBy
        }, { session });
        await session.commitTransaction();
        session.endSession();
        return cat;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
};


const editCategoryService = async (id, data) => {

    const result = await categoryModel.findByIdAndUpdate(id, data, { new: true });
    if(result){
        await addAuditReport({
            action: "Edit",
            summary: `Category ${result.name} edited`,
            performedBy: data.performedBy
        });
    }
}

const deleteCategoryService = async (id) => {
    const result =  await categoryModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if(result){
        await addAuditReport({
            action: "Delete",
            summary: `Category ${result.name} deleted`,
            performedBy: data.performedBy
        });
    }
    return result;
}


const getAllCategoryService = async (option) => {
    const { page, limit } = option;
    const skip = (page - 1) * limit;
    const result = await categoryModel.find({ isDeleted: false }).skip(skip).limit(limit);
    const totalResults = await categoryModel.countDocuments({ isDeleted: false });
    return { result, pagination: { totalResults, totalPages: Math.ceil(totalResults / limit), currentPage: page, limit } };

}


module.exports = { addCategoryService, editCategoryService, deleteCategoryService, getAllCategoryService }