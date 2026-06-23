const commissionModel = require("./commission.model");

const editCommissionService = async (id, data) => {
    return await commissionModel.findOneAndUpdate({ _id: id }, data, { new: true });
}


const deleteCommissionService = async (id) => {
    return await commissionModel.findByIdAndDelete(id);
}

const getAllCommissionService = async (options) => {
    const { page , limit} = options;
    const skip = (page - 1) * limit;
    const [result, totalResults] = await Promise.all([
        commissionModel.aggregate([
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: "categories",
                    localField: "category",
                    foreignField: "_id",
                    as: "categoryData"
                }
            },
            { $unwind: "$categoryData" },
            { $project: { category: "$categoryData.name", commission: 1 } }
        ]
        ),
        commissionModel.countDocuments()
    ])
    return { result, pagination: { totalResults, totalPages: Math.ceil(totalResults / limit), currentPage: page, limit } };
}


module.exports = { editCommissionService, deleteCommissionService, getAllCommissionService }