const resolveCompanyId = require('../../helpers/resolveCompanyId');
const DepartmentModel = require('./department.model');

const addDepartmentService = async (DepartmentData) => {
    const company = await resolveCompanyId(DepartmentData.loginUser);
    DepartmentData.employer = company._id
    const result = await DepartmentModel.create(DepartmentData);
    return result;
}

const getDepartmentService = async (options, loginUser) => {
    const company = await resolveCompanyId(loginUser);

    const { page = 1, limit = 10, search } = options;

    const skip = (page - 1) * limit;

    // SEARCH CONDITION
    const matchStage = {isDeleted: false, employer: company._id};

    if (search) {
        matchStage.name = {
            $regex: search,
            $options: "i" // case insensitive
        };
    }

    const result = await DepartmentModel.aggregate([
        { $match: matchStage },

        { $sort: { createdAt: -1 } },

        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            departmentId: "$_id",
                            description: 1,
                            name: 1,
                            createdAt: 1
                        }
                    }
                ],
                totalCount: [
                    { $count: "count" }
                ]
            }
        }
    ]);

    const departments = result[0].data;
    const totalResults = result[0].totalCount[0]?.count || 0;

    return {
        result: departments,
        pagination: {
            totalResults,
            currentPage: page,
            totalPages: Math.ceil(totalResults / limit),
            limit
        }
    };
};


const getDepartmentByIdService = async (id) => {
    const result = await DepartmentModel.findById(id);
    return result;
}


const updateDepartmentService = async (id, DepartmentData) => {
    const result = await DepartmentModel.findByIdAndUpdate(id, DepartmentData, { new: true });
    return result;
}


const deleteDepartmentService = async (id) => {
    const result = await DepartmentModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    return result;
}


module.exports = { addDepartmentService, getDepartmentService, getDepartmentByIdService, updateDepartmentService, deleteDepartmentService }