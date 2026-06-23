const { addAuditReport } = require("../Audit/audit.service");
const SubSubCategory = require("./subCategory.model");


const addSubCategoryService = async (data) => {
    const subcategory = await SubSubCategory.create(data);
    if(subcategory){
        await addAuditReport({
            action: "Add",
            summary: `SubCategory ${subcategory.name} added`,
            performedBy: data.performedBy
        });
    }
    return subcategory;
}

const editSubCategoryService = async (id, data) => {
    const result = await SubSubCategory.findByIdAndUpdate(id, data, { new: true });
    if(result){
        await addAuditReport({
            action: "Edit",
            summary: `SubCategory ${result.name} edited`,
            performedBy: data.performedBy
        });
    }
    return result;
}

const deleteSubCategoryService = async (id) => {
    const result = await SubSubCategory.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    if(result){
        await addAuditReport({
            action: "Delete",
            summary: `SubCategory ${result.name} deleted`,
            performedBy: data.performedBy
        });
    }
    return result;
}


const getAllSubCategoryService = async (category, option) => {
    const { page, limit } = option;
    const skip = (page - 1) * limit;
    const result = await SubSubCategory.find({ category: category, isDeleted: false }).skip(skip).limit(limit);
    const totalResults = await SubSubCategory.countDocuments({ category: category, isDeleted: false });
    return { result, pagination: { totalResults, totalPages: Math.ceil(totalResults / limit), currentPage: page, limit } };

}


module.exports = { addSubCategoryService, editSubCategoryService, deleteSubCategoryService, getAllSubCategoryService }