const { default: mongoose } = require('mongoose');
const allocationManagementModel = require('../AllocationManagement/allocationManagement.model');
const employeeModel = require('../Employee/employee.model');
const allocatedModel = require('./allocate.model');


// const addAllocatedService = async (data) => {

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         if (data.frequency && data.isRecurring && data.startDate) {
//             const expire =
//                 new Date(data.startDate).getTime() +
//                 data.frequency * 24 * 60 * 60 * 1000;

//             data.expireDate = new Date(expire);
//         }

//         const company = await employerModel.findOne({
//             user: data.user,
//             // isDeleted: false
//         }).session(session);

//         if (!company) {
//             throw new Error("Company not found");
//         }

//         let employeeFilter = {
//             company: company.user,
//             // status: "active"
//         };

//         if (data.allocateTo === "department") {
//             if (!data.department)
//                 throw new Error("Department required");

//             employeeFilter.department = data.department;
//         }

//         if (data.allocateTo === "branch") {
//             if (!data.branch)
//                 throw new Error("Branch required");

//             employeeFilter.branch = data.branch;
//         }
// console.log({employeeFilter})
//         const employees = await employeeModel
//             .find(employeeFilter)
//             .session(session);

//         if (!employees.length) {
//             throw new Error("No employees found for allocation");
//         }

//         const creditAmount = data.creditPerEmployee || 0;

//         const userIds = employees.map(emp => emp.user);
//         await userModel.updateMany(
//             { _id: { $in: userIds } },
//             {
//                 $inc: { digitalWallet: creditAmount }
//             },
//             { session }
//         );
//         await employeeModel.updateMany(
//             { _id: { $in: employees.map(e => e._id) } },
//             {
//                 $inc: { credit: creditAmount }
//             },
//             { session }
//         );
//         const totalAllocated = creditAmount * employees.length;

//         await employerModel.updateOne(
//             { _id: company._id },
//             {
//                 $inc: {
//                     totalFunded: totalAllocated,
//                     creditBalance: totalAllocated
//                 }
//             },
//             { session }
//         );

//         const allocation = await allocatedModel.create(
//             [data],
//             { session }
//         );

//         await session.commitTransaction();
//         session.endSession();

//         return allocation[0];

//     } catch (error) {
//         await session.abortTransaction();
//         session.endSession();
//         throw error;
//     }
// };



const addAllocatedService = async (data, companyId) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Calculate expireDate for recurring or non-recurring
        if (data.isRecurring && data.frequency && data.startDate) {
            const expire = new Date(data.startDate);
            expire.setDate(expire.getDate() + data.frequency);
            data.expireDate = expire;
            data.lastExecutedAt = null; // will be updated by cron
        } else {
            // Non-recurring allocation: executed immediately
            data.lastExecutedAt = new Date(data.startDate);
        }

        const [allocation] = await allocatedModel.create([data], { session });

        // Fetch relevant employees
        let employees = [];
        if (data.allocateTo === 'all-employee') {
            employees = await employeeModel.find({ company: companyId, status: 'active' }).session(session);
        } else if (data.allocateTo === 'department') {
            employees = await employeeModel.find({ department: data.department, status: 'active' }).session(session);
        } else if (data.allocateTo === 'branch') {
            employees = await employeeModel.find({ branch: data.branch, status: 'active' }).session(session);
        }

        // Create wallet entries
        const wallets = employees.map(emp => ({
            user: emp.user,
            allocation: allocation._id,
            totalCredit: allocation.creditPerEmployee,
            remainingCredit: allocation.creditPerEmployee,
            usedCredit: 0,
            periodStart: allocation.startDate,
            periodEnd: allocation.expireDate
        }));

        await allocationManagementModel.insertMany(wallets, { session });

        await session.commitTransaction();
        session.endSession();

        return allocation;

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
};


const getAllAllocateService = async (options, filters) => {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const [result, totalResults] = await Promise.all([
        allocatedModel.aggregate([
            { $match: filters },

            // Lookup department info
            {
                $lookup: {
                    from: 'departments',
                    localField: 'department',
                    foreignField: '_id',
                    as: 'departmentInfo'
                }
            },
            { $unwind: { path: '$departmentInfo', preserveNullAndEmptyArrays: true } },

            // Lookup branch info
            {
                $lookup: {
                    from: 'branches',
                    localField: 'branch',
                    foreignField: '_id',
                    as: 'branchInfo'
                }
            },
            { $unwind: { path: '$branchInfo', preserveNullAndEmptyArrays: true } },

            // Calculate nextRunDate
            {
                $addFields: {
                    nextRunDate: {
                        $add: [
                            {
                                $ifNull: ["$lastExecutedAt", "$startDate"]
                            },
                            { $multiply: ["$frequency", 24 * 60 * 60 * 1000] } // frequency in ms
                        ]
                    }
                }
            },

            { $skip: skip },
            { $limit: limit },
            { $sort: { createdAt: -1 } },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    allocateTo: 1,
                    creditPrgram: 1,
                    creditPerEmployee: 1,
                    frequency: 1,
                    startDate: 1,
                    isRecurring: 1,
                    status: 1,
                    branchName: '$branchInfo.name',
                    branchId: '$branchInfo._id',
                    departmentName: '$departmentInfo.name',
                    departmentId: '$departmentInfo._id',
                    nextRunDate: 1,
                    createdAt: 1
                }
            }
        ]),

        allocatedModel.countDocuments(filters)
    ]);

    return {
        result,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit
        }
    };
};


const editAllocateService = async (id, data) => {
    return await allocatedModel.findByIdAndUpdate(id, data, { new: true });
};

const deleteAllocateService = async (id) => {
    return await allocatedModel.findByIdAndDelete(id);
};


const pauseUnpauseAllocateService = async (id) => {
    const result = await allocatedModel.findById(id);
    if (result.status === 'active') {
        result.status = 'paused';
    } else {
        result.status = 'active';
    }
    return await allocatedModel.findByIdAndUpdate(id, result, { new: true });
}

const getAllocateByIdService = async (id) => {
    return await allocatedModel.findById(id);
};

module.exports = {
    addAllocatedService,
    getAllAllocateService,
    editAllocateService,
    deleteAllocateService,
    getAllocateByIdService,
    pauseUnpauseAllocateService
}