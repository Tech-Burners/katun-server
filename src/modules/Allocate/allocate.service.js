const { default: mongoose } = require('mongoose');
const allocationManagementModel = require('../AllocationManagement/allocationManagement.model');
const employeeModel = require('../Employee/employee.model');
const allocatedModel = require('./allocate.model');
const employerModel = require('../Employer/employer.model');
const userModel = require('../User/user.model');
const transactionModel = require('../Transaction/transaction.model');
const ApiError = require('../../helpers/ApiError');
const { addAuditReport } = require('../Audit/audit.service');
const resolveCompanyId = require('../../helpers/resolveCompanyId');
const { reclaimCreditEmployeeService, bulkReclaimCreditEmployeeService } = require('../Employee/employee.service');


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



const addAllocatedService = async (data) => {
    // console.log({ data });
    const session = await mongoose.startSession();
    session.startTransaction();
    
    if (!data.companyId) {
        if (data.role === 'hr') {
            try {
                data.companyId = await resolveCompanyId(data.user);
            } catch (e) {
                const company = await employerModel.findOne({ user: data.user }).session(session);
                if (company) data.companyId = company._id;
            }
            data.isCreatedByAdmin = false;
        } else if (data.role === 'sub_hr_admin') {
            try {
                data.companyId = await resolveCompanyId(data.user);
            } catch (e) {
                // fallback handled below
            }
            data.isCreatedByAdmin = true;
        } else if (data.role === 'admin' || data.role === 'sub_admin') {
            data.isCreatedByAdmin = true;
        }
    } else {
        data.isCreatedByAdmin = data.role === 'admin' || data.role === 'sub_admin' || data.role === 'sub_hr_admin';
    }

    const companyId = data.companyId;

    try {
        // Fetch relevant employees
        let employees = [];
        if (data.allocateTo === 'all-employee') {
            employees = await employeeModel.find({ company: companyId, status: 'active' }).session(session);
        } else if (data.allocateTo === 'department') {
            employees = await employeeModel.find({ department: data.department, status: 'active' }).session(session);
        } else if (data.allocateTo === 'branch') {
            employees = await employeeModel.find({ branch: data.branch, status: 'active' }).session(session);
        }

        const creditAmount = Number(data.creditPerEmployee || 0);
        const totalAllocated = creditAmount * employees.length;

        // Verify and deduct company creditBalance if company exists
        if (companyId) {
            const company = await employerModel.findById(companyId).session(session);
            if (!company) {
                throw new ApiError(404, "Company not found");
            }

            if (totalAllocated > 0) {
                if (Number(company.creditBalance || 0) < totalAllocated) {
                    throw new ApiError(
                        412,
                        `Insufficient company credit balance. Available: ${company.creditBalance || 0}, Required: ${totalAllocated}`
                    );
                }

                // Deduct from company credit balance & increment totalSpent
                await employerModel.findByIdAndUpdate(
                    companyId,
                    {
                        $inc: {
                            creditBalance: -totalAllocated,
                            totalSpent: totalAllocated,
                        },
                    },
                    { session }
                );
            }
        }

        // Calculate expireDate for recurring or non-recurring
        if (data.isRecurring && data.frequency && data.startDate) {
            const expire = new Date(data.startDate);
            expire.setDate(expire.getDate() + data.frequency);
            data.expireDate = expire;
            data.lastExecutedAt = null; // will be updated by cron
        } else {
            // Non-recurring allocation: executed immediately
            data.lastExecutedAt = new Date(data.startDate || Date.now());
        }

        const [allocation] = await allocatedModel.create([data], { session });

        // Credit the employees' user wallets and employee records
        if (employees.length > 0 && creditAmount > 0) {
            const userIds = employees.map(emp => emp.user).filter(Boolean);
            if (userIds.length > 0) {
                await userModel.updateMany(
                    { _id: { $in: userIds } },
                    {
                        $inc: {
                            digitalWallet: creditAmount,
                            allocatedCredit: creditAmount,
                        },
                    },
                    { session }
                );
            }

            await employeeModel.updateMany(
                { _id: { $in: employees.map(e => e._id) } },
                {
                    $inc: {
                        credit: creditAmount,
                    },
                },
                { session }
            );

            // Create allocation management wallet entries
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

            // Create Transaction records for each employee so they see it in their wallet-transactions
            const companyDoc = companyId ? await employerModel.findById(companyId).session(session) : null;
            const companyName = companyDoc?.companyName || 'Company HR';

            const transactionDocs = employees
                .filter(emp => emp.user)
                .map((emp) => ({
                    tx_ref: `allocate_${Date.now()}_${emp.user}_${Math.random().toString(36).substring(2, 7)}`,
                    user: emp.user,
                    credit_owner_type: 'company',
                    credit_owner_id: companyId,
                    currency: 'NGN',
                    gross_amount: creditAmount,
                    commission: 0,
                    net_amount: creditAmount,
                    status: 'successful',
                    payment_status: 'successful',
                    payment_method: 'wallet',
                    paymentType: 'credit',
                    description: `HR credit allocated by ${companyName}: ₦${creditAmount} (${data.name || data.creditPrgram || 'Wellness benefit'})`
                }));

            if (transactionDocs.length > 0) {
                await transactionModel.insertMany(transactionDocs, { session });
            }
        }

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
    // console.log({ filters });

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

const reclaimAllocatedCreditToHrService = async (data) => {
    // 1. If employeeId is supplied, delegate to reclaimCreditEmployeeService
    if (data.employeeId) {
        return await reclaimCreditEmployeeService(data.employeeId, data);
    }

    // 2. If employeeIds array is supplied, delegate to bulkReclaimCreditEmployeeService
    if (Array.isArray(data.employeeIds) && data.employeeIds.length > 0) {
        return await bulkReclaimCreditEmployeeService(data.employeeIds, data);
    }

    // 3. If userId is provided: find employee for that user, or handle direct userId & companyId
    if (data.userId) {
        const employee = await employeeModel.findOne({ user: data.userId });
        if (employee) {
            return await reclaimCreditEmployeeService(employee._id, data);
        }

        if (!data.companyId) {
            throw new ApiError(400, "companyId is required when user has no linked employee profile");
        }

        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const user = await userModel.findById(data.userId).session(session);
            if (!user) throw new ApiError(404, "User not found");

            const company = await employerModel.findById(data.companyId).session(session);
            if (!company) throw new ApiError(404, "Company not found");

            const unusedAllocatedCredit = Math.max(
                0,
                Math.min(user.allocatedCredit || 0, user.digitalWallet || 0)
            );

            if (unusedAllocatedCredit <= 0) {
                throw new ApiError(400, "This user has no unused allocated credit to return to HR.");
            }

            let reclaimAmount;
            if (data.amount !== undefined && data.amount !== null && data.amount !== 'all') {
                const requestedAmount = Number(data.amount);
                if (isNaN(requestedAmount) || requestedAmount <= 0) {
                    throw new ApiError(400, "Invalid reclaim amount");
                }
                if (requestedAmount > unusedAllocatedCredit) {
                    throw new ApiError(
                        400,
                        `Requested amount (${requestedAmount} NGN) exceeds available unused allocated credit (${unusedAllocatedCredit} NGN).`
                    );
                }
                reclaimAmount = Number(requestedAmount.toFixed(2));
            } else {
                reclaimAmount = Number(unusedAllocatedCredit.toFixed(2));
            }

            user.allocatedCredit = Math.max(0, Number(((user.allocatedCredit || 0) - reclaimAmount).toFixed(2)));
            user.digitalWallet = Math.max(0, Number(((user.digitalWallet || 0) - reclaimAmount).toFixed(2)));
            await user.save({ session });

            company.creditBalance = Number(((company.creditBalance || 0) + reclaimAmount).toFixed(2));
            await company.save({ session });

            const tx_ref = `reclaim_${Date.now()}_${user._id}`;
            await transactionModel.create([
                {
                    tx_ref,
                    user: user._id,
                    partner: company.user?.[0] || user._id,
                    user_email: user.email,
                    currency: 'NGN',
                    gross_amount: reclaimAmount,
                    commission: 0,
                    net_amount: reclaimAmount,
                    status: 'successful',
                    payment_status: 'successful',
                    payment_method: 'wallet',
                    paymentType: 'reclaim',
                    description: `Admin manual reclaim: ${reclaimAmount} NGN unused HR credit returned to ${company.companyName || 'company'}`
                }
            ], { session });

            await addAuditReport(
                {
                    action: "reclaim",
                    summary: `Admin reclaimed ${reclaimAmount} NGN unused allocated credit from ${user.fullName} back to ${company.companyName}`,
                    performedBy: data.performedBy
                },
                session
            );

            await session.commitTransaction();

            return {
                userId: user._id,
                userName: user.fullName,
                companyId: company._id,
                companyName: company.companyName,
                reclaimedAmount: reclaimAmount,
                userDigitalWallet: user.digitalWallet,
                userAllocatedCredit: user.allocatedCredit,
                userRechargedCredit: user.rechargedCredit || 0,
                companyCreditBalance: company.creditBalance
            };
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    throw new ApiError(400, "Please provide employeeId, employeeIds, or userId to reclaim credit.");
};

module.exports = {
    addAllocatedService,
    getAllAllocateService,
    editAllocateService,
    deleteAllocateService,
    getAllocateByIdService,
    pauseUnpauseAllocateService,
    reclaimAllocatedCreditToHrService
}