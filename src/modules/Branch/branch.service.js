const resolveCompanyId = require("../../helpers/resolveCompanyId");
const branchModel = require("./branch.model");

const addBranchService = async (branchData) => {
    const company = await resolveCompanyId(branchData.loginUser);
    branchData.employer = company._id
    const result = await branchModel.create(branchData);
    return result;
}

const getBranchService = async (options, loginUser) => {
    const company = await resolveCompanyId(loginUser);
    const { page = 1, limit = 10, search } = options;

    const skip = (page - 1) * limit;

    // SEARCH CONDITION
    const matchStage = { isDeleted: false , employer: company._id };

    if (search) {
        matchStage.$or = [
            { name: { $regex: search, $options: 'i' } },
            { city: { $regex: search, $options: 'i' } },
            { address: { $regex: search, $options: 'i' } }
        ];
    }

    const result = await branchModel.aggregate([
        { $match: matchStage },

        { $sort: { createdAt: -1 } },

        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            branchId: "$_id",
                            name: 1,
                            city: 1,
                            address: 1,
                            location: 1
                        }
                    }
                ],
                totalCount: [
                    { $count: "count" }
                ]
            }
        }
    ]);

    const branches = result[0].data;
    const totalResults = result[0].totalCount[0]?.count || 0;

    return {
        result: branches,
        pagination: {
            totalResults,
            currentPage: page,
            totalPages: Math.ceil(totalResults / limit),
            limit
        }
    };
};

const getBranchByIdService = async (id) => {
    const result = await branchModel.findById(id);
    return result;
}


const updateBranchService = async (id, branchData) => {
    const result = await branchModel.findByIdAndUpdate(id, branchData, { new: true });
    return result;
}


const deleteBranchService = async (id) => {
    const result = await branchModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    return result;
}


module.exports = { addBranchService, getBranchService, getBranchByIdService, updateBranchService, deleteBranchService }