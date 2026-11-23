const ApiError = require("../../helpers/ApiError");
const resolveCompanyId = require("../../helpers/resolveCompanyId");
const adminModel = require("../Admin/admin.model");
const { addAuditReport } = require("../Audit/audit.service");
const { updateUserById } = require("../Auth/auth.service");
const employerModel = require("../Employer/employer.model");
const userModel = require("../User/user.model");
const employeeModel = require("./employee.model");
const transactionModel = require("../Transaction/transaction.model");
const mongoose = require("mongoose");
const {
    sendStaffCredentialsEmail,
    sendAccountSuspendedEmail,
    sendAccountActivatedEmail,
} = require("../../helpers/emailNotification");

// const addEmployeeService = async (data) => {

//     if (data.phone) {
//         const existingUser = await userModel.findOne({
//             number: data.phone
//         });

//         if (existingUser) {
//             throw new ApiError(400, 'This number already used!');
//         }
//     }

//     const session = await mongoose.startSession();

//     try {

//         session.startTransaction();

//         // ✅ Create User
//         const user = await userModel.create([{
//             fullName: data.name,
//             number: data.phone,
//             password: process.env.DEFAULT_PASSWORD,
//         }], { session });

//         data.user = user[0]._id;

//         // ✅ Create Employee
//         const employee = await employeeModel.create([data], { session });

//         // ✅ Get Employer safely
//         const employer = await employerModel
//             .findById(data.company)
//             .session(session);

//         if (!employer) {
//             throw new ApiError(404, 'Employer not found');
//         }

//         // ✅ Update counts safely
//         employer.employeeCount = (employer.employeeCount || 0) + 1;
//         employer.activeEmployeeCount =
//             (employer.activeEmployeeCount || 0) + 1;

//         await employer.save({ session });

//         await session.commitTransaction();

//         return employee[0];

//     } catch (err) {

//         await session.abortTransaction();
//         throw err;

//     } finally {
//         session.endSession();
//     }
// };


const addEmployeeService = async (data) => {

    if (!data.email) {
        throw new ApiError(400, 'Email is required');
    }

    // Check duplicate email
    const existingEmailUser = await userModel.findOne({
        email: data.email.toLowerCase().trim(),
        isDeleted: { $ne: true }
    });

    if (existingEmailUser) {
        throw new ApiError(400, 'This email is already used!');
    }

    // Check duplicate phone number if provided
    if (data.number) {
        const numberQuery = {
            number: data.number,
            isDeleted: { $ne: true }
        };
        if (data.countryCode) {
            numberQuery.countryCode = data.countryCode;
        }

        const existingUser = await userModel.findOne(numberQuery);

        if (existingUser) {
            throw new ApiError(400, 'This number is already used!');
        }
    } else if (data.phone) {
        const existingPhoneUser = await userModel.findOne({
            $or: [
                { number: data.phone },
                { phone: data.phone }
            ],
            isDeleted: { $ne: true }
        });

        if (existingPhoneUser) {
            throw new ApiError(400, 'This phone number is already used!');
        }
    }

    const session = await mongoose.startSession();

    try {

        await session.startTransaction();

        // Create User
        const userPayload = {
            fullName: data.name,
            role: 'user',
            password: process.env.DEFAULT_PASSWORD,
        };

        if (data.email) {
            userPayload.email = data.email.toLowerCase().trim();
        }
        if (data.number) {
            userPayload.number = data.number;
        }
        if (data.countryCode) {
            userPayload.countryCode = data.countryCode;
        }

        const user = await userModel.create([userPayload], { session });

        data.user = user[0]._id;

        if (data.email) {
            data.email = data.email.toLowerCase().trim();
        }

        // Combine country code + number for Employee phone
        if (data.countryCode && data.number) {
            data.phone = `${data.countryCode}${data.number}`;
        }

        // Create Employee
        const employee = await employeeModel.create([data], { session });

        // Get Employer
        const employer = await employerModel
            .findById(data.company)
            .session(session);

        if (!employer) {
            throw new ApiError(404, 'Employer not found');
        }

        // Update counts
        employer.employeeCount = (employer.employeeCount || 0) + 1;
        employer.activeEmployeeCount =
            (employer.activeEmployeeCount || 0) + 1;

        await employer.save({ session });

        await session.commitTransaction();

        if (data.email) {
            sendStaffCredentialsEmail({
                email: data.email,
                fullName: data.name,
                role: "Employee",
                temporaryPassword: process.env.DEFAULT_PASSWORD || "hello123",
            }).catch((err) => console.error("Employee credentials email error:", err.message));
        }

        return employee[0];

    } catch (err) {

        await session.abortTransaction();
        throw err;

    } finally {
        await session.endSession();
    }
};


const getEmployeeService = async (id) => {
    return await employeeModel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(String(id)) } },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'employers',
                localField: 'company',
                foreignField: '_id',
                as: 'emplyerData'
            }
        },
        {
            $unwind: {
                path: "$emplyerData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                name: 1,
                phone: 1,
                email: { $ifNull: ["$email", "$user.email"] },
                number: "$user.number",
                countryCode: "$user.countryCode",
                createdAt: 1,
                userType: "$user.role",
                isBan: "$user.isBan",
                wallet: "$user.digitalWallet",
                digitalWallet: "$user.digitalWallet",
                allocatedCredit: { $ifNull: ["$user.allocatedCredit", 0] },
                rechargedCredit: { $ifNull: ["$user.rechargedCredit", 0] },
                rating: "$user.rating",
                bookingCompleted: "$user.bookingCompleted",
                reportCount: "$user.reportCount",
                flagCount: "$user.flagCount",
                note: "$user.note",
                employer: "$emplyerData.companyName"
            }
        }
    ])
}


const getAllEmployeeService = async (option) => {
    const {
        page = 1,
        limit = 10,
        search,
        department,
        branch,
        status,
        company
    } = option;

    const skip = (page - 1) * limit;

    // dynamic match object
    const matchStage = {};

    if (status) {
        matchStage.status = status;
    }
    if (company) {
        matchStage.company = new mongoose.Types.ObjectId(company);
    }

    // if (department) {
    //     matchStage.department = new mongoose.Types.ObjectId(String(department));
    // }

    // if (branch) {
    //     matchStage.branch = new mongoose.Types.ObjectId(String(branch));
    // }

    const result = await employeeModel.aggregate([

        { $match: matchStage },

        { $sort: { createdAt: -1 } },

        // USER JOIN
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'employers',
                localField: 'company',
                foreignField: '_id',
                as: 'emplyerData'
            }
        },
        {
            $unwind: {
                path: "$emplyerData",
                preserveNullAndEmptyArrays: true
            }
        },
        // // DEPARTMENT JOIN
        // {
        //     $lookup: {
        //         from: "departments",
        //         localField: "department",
        //         foreignField: "_id",
        //         as: "department"
        //     }
        // },

        // {
        //     $unwind: {
        //         path: "$department",
        //         preserveNullAndEmptyArrays: true
        //     }
        // },

        // // BRANCH JOIN
        // {
        //     $lookup: {
        //         from: "branches",
        //         localField: "branch",
        //         foreignField: "_id",
        //         as: "branch"
        //     }
        // },
        // {
        //     $unwind: {
        //         path: "$branch",
        //         preserveNullAndEmptyArrays: true
        //     }
        // },
        ...(search ? [{
            $match: {
                $or: [
                    { "user.fullName": { $regex: search, $options: "i" } },
                    { "user.email": { $regex: search, $options: "i" } },
                    { "user.number": { $regex: search, $options: "i" } },
                    { name: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            }
        }] : []),

        {
            $facet: {

                employee: [
                    { $skip: skip },
                    { $limit: limit },

                    {
                        $project: {
                            employeeId: "$_id",
                            userId: "$user._id",
                            employeeName: "$user.fullName",
                            wallet: { $ifNull: ["$user.digitalWallet", 0] },
                            digitalWallet: { $ifNull: ["$user.digitalWallet", 0] },
                            allocatedCredit: { $ifNull: ["$user.allocatedCredit", 0] },
                            rechargedCredit: { $ifNull: ["$user.rechargedCredit", 0] },
                            credit: { $ifNull: ["$credit", 0] },
                            email: { $ifNull: ["$email", "$user.email"] },
                            number: "$user.number",
                            countryCode: "$user.countryCode",
                            phone: 1,
                            status: 1,
                            companyName: "$emplyerData.companyName",
                            companyId: "$emplyerData._id",
                            isBan: "$user.isBan",
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

    const employee = result[0].employee;
    const totalResults = result[0].totalCount[0]?.count || 0;

    return {
        employee,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit
        }
    };
};


const getCompanyAllEmployeeService = async (user, option) => {
    const companyId = await resolveCompanyId(user);
    const {
        page = 1,
        limit = 10,
        search,
        department,
        branch,
        status
    } = option;

    const skip = (page - 1) * limit;

    const matchStage = {
        company: new mongoose.Types.ObjectId(companyId)
    };

    if (status) {
        matchStage.status = status;
    }

    if (department) {
        matchStage.department = new mongoose.Types.ObjectId(String(department));
    }

    if (branch) {
        matchStage.branch = new mongoose.Types.ObjectId(String(branch));
    }

    const result = await employeeModel.aggregate([

        { $match: matchStage },

        { $sort: { createdAt: -1 } },

        // USER JOIN
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
            }
        },
        {
            $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'employers',
                localField: 'company',
                foreignField: '_id',
                as: 'emplyerData'
            }
        },
        {
            $unwind: {
                path: "$emplyerData",
                preserveNullAndEmptyArrays: true
            }
        },
        // DEPARTMENT JOIN
        {
            $lookup: {
                from: "departments",
                localField: "department",
                foreignField: "_id",
                as: "department"
            }
        },

        {
            $unwind: {
                path: "$department",
                preserveNullAndEmptyArrays: true
            }
        },

        // BRANCH JOIN
        {
            $lookup: {
                from: "branches",
                localField: "branch",
                foreignField: "_id",
                as: "branch"
            }
        },
        {
            $unwind: {
                path: "$branch",
                preserveNullAndEmptyArrays: true
            }
        },
        ...(search ? [{
            $match: {
                $or: [
                    { "user.fullName": { $regex: search, $options: "i" } },
                    { "user.email": { $regex: search, $options: "i" } },
                    { "user.number": { $regex: search, $options: "i" } },
                    { name: { $regex: search, $options: "i" } },
                    { phone: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ]
            }
        }] : []),

        {
            $facet: {

                employee: [
                    { $skip: skip },
                    { $limit: limit },

                    {
                        $project: {
                            employeeId: "$_id",
                            employeeName: "$user.fullName",
                            wallet: "$user.wallet",
                            usages: "$user.usages",
                            email: { $ifNull: ["$email", "$user.email"] },
                            number: "$user.number",
                            countryCode: "$user.countryCode",
                            phone: 1,
                            departmentName: "$department.name",
                            branchname: "$branch.name",
                            totalUseage: "$usages",
                            status: 1,
                            companyName: "$emplyerData.companyName",
                            isBan: "$user.isBan",
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

    const employee = result[0].employee;
    const totalResults = result[0].totalCount[0]?.count || 0;

    return {
        employee,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit
        }
    };
};

const addNoteService = async (id, data) => {
    const seassion = await mongoose.startSession();
    try {
        seassion.startTransaction();
        const employee = await employeeModel.findById(id).session(seassion);
        const userData = await userModel.findByIdAndUpdate(employee.user, { note: data.note }, { new: true, session: seassion });
        // console.log({ userData });
        await addAuditReport({
            action: "Note",
            summary: `Employee ${userData.fullName} added note`,
            performedBy: data.performedBy
        })
        await seassion.commitTransaction();
        seassion.endSession();
        return employee;
    } catch (err) {
        await seassion.abortTransaction();
        seassion.endSession();
        throw err;
    }
}

const bulkAddNoteService = async (employeeIds, data) => {
    console.log({ employeeIds, data });
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const employees = await employeeModel
            .find({
                _id: { $in: employeeIds },
            })
            .populate("user", "fullName")
            .session(session);

        if (!employees.length) {
            throw new Error("No employees found");
        }

        const userIds = employees.map(employee => employee.user._id);
console.log({ userIds });
        const result = await userModel.updateMany(
            {
                _id: { $in: userIds },
            },
            {
                $set: {
                    note: data.note,
                },
            },
            { session }
        );
console.log({ result });
        await Promise.all(
            employees.map(employee =>
                addAuditReport(
                    {
                        action: "Note",
                        summary: `Note added for employee ${employee.name}`,
                        performedBy: data.performedBy,
                    },
                    { session }
                )
            )
        );

        await session.commitTransaction();

        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
        };
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};


const allocateCreditEmployeeService = async (employeeId, data) => {
    // console.log({ data });
    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        let company = null;

        if (data.role === 'hr') {
            company = await employerModel.findOne({ user: data.performedBy })
        } else if (data.role === 'sub_hr_admin') {
            const parent = await adminModel.findOne({ user: data.performedBy })
            if (parent) {
                company = await employerModel.findOne({ user: parent.parent })
            }
        }

        if (company) {
            if (Number(company.creditBalance) < Number(data.amount)) {
                throw new ApiError(412, "Insufficient balance")
            }

            company.creditBalance = Number(company.creditBalance) - Number(data.amount);
            await company.save();
        }

        const employee = await employeeModel
            .findById(employeeId)
            .select('user')
            .session(session);

        if (!employee) {
            throw new Error("Employee not found");
        }

        const userData = await userModel.findByIdAndUpdate(
            employee.user,
            {
                $inc: {
                    digitalWallet: Number(data.amount),
                    allocatedCredit: Number(data.amount)
                }
            },
            { new: true, session }
        );

        await employeeModel.findByIdAndUpdate(
            employeeId,
            { $inc: { credit: Number(data.amount) } },
            { session }
        );

        if (!userData) {
            throw new Error("User not found");
        }

        await addAuditReport(
            {
                action: "allocate",
                summary: `credit allocated to ${userData.fullName}`,
                performedBy: data.performedBy
            },
            session
        );

        await session.commitTransaction();
        session.endSession();

        return userData;

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const bulkAllocateCreditEmployeeService = async (employeeIds, data) => {
    const session = await mongoose.startSession();
console.log({ employeeIds, data });
    try {
        session.startTransaction();

        let company = null;

        if (data.role === "hr") {
            company = await employerModel
                .findOne({ user: data.performedBy })
                .session(session);
        } else if (data.role === "sub_hr_admin") {
            const admin = await adminModel
                .findOne({ user: data.performedBy })
                .session(session);

            if (admin) {
                company = await employerModel
                    .findOne({ user: admin.parent })
                    .session(session);
            }
        }

        const employees = await employeeModel
            .find({
                _id: { $in: employeeIds },
            })
            .populate("user", "fullName")
            .session(session);

        if (!employees.length) {
            throw new ApiError(404, "No employees found");
        }

        const amount = Number(data.amount);
        const totalAmount = amount * employees.length;

        if (company) {
            if (Number(company.creditBalance) < totalAmount) {
                throw new ApiError(
                    412,
                    `Insufficient balance. Available ${company.creditBalance}, Required ${totalAmount}`
                );
            }

            await employerModel.findByIdAndUpdate(
                company._id,
                {
                    $inc: {
                        creditBalance: -totalAmount,
                    },
                },
                { session }
            );
        }

        const userIds = employees.map((e) => e.user._id);

        const result = await userModel.updateMany(
            {
                _id: { $in: userIds },
            },
            {
                $inc: {
                    digitalWallet: amount,
                    allocatedCredit: amount,
                },
            },
            { session }
        );

        await employeeModel.updateMany(
            {
                _id: { $in: employeeIds },
            },
            {
                $inc: {
                    credit: amount,
                },
            },
            { session }
        );

        await Promise.all(
            employees.map((employee) =>
                addAuditReport(
                    {
                        action: "Allocate",
                        summary: `Credit allocated to ${employee.user.fullName}`,
                        performedBy: data.performedBy,
                    },
                    { session }
                )
            )
        );

        await session.commitTransaction();

        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
        };
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

const reclaimCreditEmployeeService = async (employeeId, data) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const employee = await employeeModel
            .findById(employeeId)
            .populate('company')
            .populate('user')
            .session(session);

        if (!employee) {
            throw new ApiError(404, "Employee not found");
        }

        const company = await employerModel
            .findById(employee.company?._id || employee.company)
            .session(session);

        if (!company) {
            throw new ApiError(404, "Company/Employer not found for this employee");
        }

        const userData = await userModel
            .findById(employee.user?._id || employee.user)
            .session(session);

        if (!userData) {
            throw new ApiError(404, "User not found for this employee");
        }

        // Available unused HR-allocated credit that can be reclaimed
        const unusedAllocatedCredit = Math.max(
            0,
            Math.min(userData.allocatedCredit || 0, userData.digitalWallet || 0)
        );

        if (unusedAllocatedCredit <= 0) {
            throw new ApiError(400, "This employee has no unused allocated credit to return to HR.");
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

        // Deduct from employee / user
        userData.allocatedCredit = Math.max(0, Number(((userData.allocatedCredit || 0) - reclaimAmount).toFixed(2)));
        userData.digitalWallet = Math.max(0, Number(((userData.digitalWallet || 0) - reclaimAmount).toFixed(2)));
        await userData.save({ session });

        employee.credit = Math.max(0, Number(((employee.credit || 0) - reclaimAmount).toFixed(2)));
        await employee.save({ session });

        // Refund back to HR (Employer creditBalance)
        company.creditBalance = Number(((company.creditBalance || 0) + reclaimAmount).toFixed(2));
        await company.save({ session });

        // Record reclaim transaction
        const tx_ref = `reclaim_${Date.now()}_${userData._id}`;
        await transactionModel.create([
            {
                tx_ref,
                user: userData._id,
                partner: company.user?.[0] || userData._id,
                user_email: userData.email,
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
        ], { session, ordered: true });

        await addAuditReport(
            {
                action: "reclaim",
                summary: `Admin reclaimed ${reclaimAmount} NGN unused allocated credit from ${userData.fullName} back to ${company.companyName}`,
                performedBy: data.performedBy
            },
            session
        );

        await session.commitTransaction();

        return {
            employeeId: employee._id,
            employeeName: userData.fullName,
            companyId: company._id,
            companyName: company.companyName,
            reclaimedAmount: reclaimAmount,
            userDigitalWallet: userData.digitalWallet,
            userAllocatedCredit: userData.allocatedCredit,
            userRechargedCredit: userData.rechargedCredit || 0,
            companyCreditBalance: company.creditBalance
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const bulkReclaimCreditEmployeeService = async (employeeIds, data) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
            throw new ApiError(400, "employeeIds array is required");
        }

        const employees = await employeeModel
            .find({ _id: { $in: employeeIds } })
            .populate('company')
            .populate('user')
            .session(session);

        if (!employees.length) {
            throw new ApiError(404, "No employees found");
        }

        const results = [];
        let totalReclaimed = 0;

        for (const employee of employees) {
            const company = await employerModel
                .findById(employee.company?._id || employee.company)
                .session(session);

            const userData = await userModel
                .findById(employee.user?._id || employee.user)
                .session(session);

            if (!company || !userData) continue;

            const unusedAllocatedCredit = Math.max(
                0,
                Math.min(userData.allocatedCredit || 0, userData.digitalWallet || 0)
            );

            if (unusedAllocatedCredit <= 0) continue;

            let reclaimAmount;
            if (data.amount !== undefined && data.amount !== null && data.amount !== 'all') {
                const requestedAmount = Number(data.amount);
                if (isNaN(requestedAmount) || requestedAmount <= 0) continue;
                reclaimAmount = Math.min(requestedAmount, unusedAllocatedCredit);
            } else {
                reclaimAmount = unusedAllocatedCredit;
            }

            reclaimAmount = Number(reclaimAmount.toFixed(2));
            if (reclaimAmount <= 0) continue;

            userData.allocatedCredit = Math.max(0, Number(((userData.allocatedCredit || 0) - reclaimAmount).toFixed(2)));
            userData.digitalWallet = Math.max(0, Number(((userData.digitalWallet || 0) - reclaimAmount).toFixed(2)));
            await userData.save({ session });

            employee.credit = Math.max(0, Number(((employee.credit || 0) - reclaimAmount).toFixed(2)));
            await employee.save({ session });

            company.creditBalance = Number(((company.creditBalance || 0) + reclaimAmount).toFixed(2));
            await company.save({ session });

            const tx_ref = `reclaim_${Date.now()}_${userData._id}_${Math.floor(Math.random() * 1000)}`;
            await transactionModel.create([
                {
                    tx_ref,
                    user: userData._id,
                    partner: company.user?.[0] || userData._id,
                    user_email: userData.email,
                    currency: 'NGN',
                    gross_amount: reclaimAmount,
                    commission: 0,
                    net_amount: reclaimAmount,
                    status: 'successful',
                    payment_status: 'successful',
                    payment_method: 'wallet',
                    paymentType: 'reclaim',
                    description: `Admin manual bulk reclaim: ${reclaimAmount} NGN unused HR credit returned to ${company.companyName || 'company'}`
                }
            ], { session });

            await addAuditReport(
                {
                    action: "bulk_reclaim",
                    summary: `Admin bulk reclaimed ${reclaimAmount} NGN from ${userData.fullName} back to ${company.companyName}`,
                    performedBy: data.performedBy
                },
                session
            );

            totalReclaimed += reclaimAmount;
            results.push({
                employeeId: employee._id,
                employeeName: userData.fullName,
                reclaimedAmount: reclaimAmount,
                remainingWallet: userData.digitalWallet
            });
        }

        await session.commitTransaction();

        return {
            totalReclaimed: Number(totalReclaimed.toFixed(2)),
            processedCount: results.length,
            details: results
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const flagEmployeeService = async (employeeId, performedBy) => {

    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        const emply = await employeeModel.findById(employeeId).select("user");
        // console.log({ emply })
        const userData = await userModel
            .findById(emply.user)
            .session(session);

        if (!userData) {
            throw new Error("User not found");
        }

        userData.flagCount = (userData.flagCount || 0) + 1;
        await userData.save({ session });

        await addAuditReport(
            {
                action: "Flag",
                summary: `Employee ${userData.fullName} get a flag.`,
                performedBy
            },
            session
        );

        await session.commitTransaction();
        session.endSession();

        return userData;

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};


const bulkFlagEmployeeService = async (employeeIds, performedBy) => {
    console.log({ employeeIds, performedBy });
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const employees = await employeeModel
            .find({
                _id: { $in: employeeIds },
            })
            .populate("user", "fullName")
            .session(session);
console.log({ employees });
        if (!employees.length) {
            throw new Error("No employees found");
        }

        const userIds = employees.map(employee => employee.user._id);

        const result = await userModel.updateMany(
            {
                _id: { $in: userIds },
            },
            {
                $inc: {
                    flagCount: 1,
                },
            },
            { session }
        );

        await Promise.all(
            employees.map((employee) =>
                addAuditReport(
                    {
                        action: "Flag",
                        summary: `Employee ${employee.user.fullName} got a flag.`,
                        performedBy,
                    },
                    { session }
                )
            )
        );

        await session.commitTransaction();

        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
        };
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const suspendEmployeeService = async (id, user) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await employeeModel.findByIdAndUpdate(id, { status: "suspended" }, { new: true }, { session });
        // console.log({ result });
        await userModel.findByIdAndUpdate(result.user, { isBan: true }, { session });
        await addAuditReport({
            action: "Suspend",
            summary: `Employee ${result.name} suspended`,
            performedBy: user
        }, { session });
        await session.commitTransaction();
        session.endSession();

        if (result?.email) {
            sendAccountSuspendedEmail({
                email: result.email,
                fullName: result.name,
                role: "Employee",
            }).catch((err) => console.error("Employee suspended email error:", err.message));
        }

        return result;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
}



const activeEmployeeService = async (id, user) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await employeeModel.findByIdAndUpdate(id, { status: "active" }, { new: true }, { session });
        // console.log({ result });
        await userModel.findByIdAndUpdate(result.user, { isBan: false }, { session });
        await addAuditReport({
            action: "Activate",
            summary: `Employee ${result.name} activated`,
            performedBy: user
        }, { session });
        await session.commitTransaction();
        session.endSession();

        if (result?.email) {
            sendAccountActivatedEmail({
                email: result.email,
                fullName: result.name,
                role: "Employee",
            }).catch((err) => console.error("Employee activated email error:", err.message));
        }

        return result;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
}


const bulkSuspendEmployeeService = async (employeeIds, performedBy) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const employees = await employeeModel
            .find({
                _id: { $in: employeeIds },
            })
            .populate("user", "fullName")
            .session(session);

        if (!employees.length) {
            throw new Error("No employees found");
        }

        await employeeModel.updateMany(
            {
                _id: { $in: employeeIds },
            },
            {
                $set: {
                    status: "suspended",
                },
            },
            { session }
        );

        const userIds = employees.map(employee => employee.user._id);

        const result = await userModel.updateMany(
            {
                _id: { $in: userIds },
            },
            {
                $set: {
                    isBan: true,
                },
            },
            { session }
        );

        await Promise.all(
            employees.map(employee =>
                addAuditReport(
                    {
                        action: "Suspend",
                        summary: `Employee ${employee.name} suspended`,
                        performedBy,
                    },
                    { session }
                )
            )
        );

        await session.commitTransaction();

        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
        };
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

const bulkActiveEmployeeService = async (employeeIds, performedBy) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const employees = await employeeModel
            .find({
                _id: { $in: employeeIds },
            })
            .populate("user", "fullName")
            .session(session);

        if (!employees.length) {
            throw new Error("No employees found");
        }

        await employeeModel.updateMany(
            {
                _id: { $in: employeeIds },
            },
            {
                $set: {
                    status: "active",
                },
            },
            { session }
        );

        const userIds = employees.map(employee => employee.user._id);

        const result = await userModel.updateMany(
            {
                _id: { $in: userIds },
            },
            {
                $set: {
                    isBan: false,
                },
            },
            { session }
        );

        await Promise.all(
            employees.map(employee =>
                addAuditReport(
                    {
                        action: "Activate",
                        summary: `Employee ${employee.name} activated`,
                        performedBy,
                    },
                    { session }
                )
            )
        );

        await session.commitTransaction();

        return {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
        };
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

// const editEmployeeService = async (id, data) => {
//     return await employeeModel.findByIdAndUpdate(id, data, { new: true });
// }

const editEmployeeService = async (id, data) => {
    const session = await mongoose.startSession();

    try {
        await session.startTransaction();

        // Find employee
        const employee = await employeeModel.findById(id).session(session);

        if (!employee) {
            throw new ApiError(404, "Employee not found");
        }

        // Check duplicate email
        if (data.email) {
            const existingEmailUser = await userModel.findOne({
                email: data.email.toLowerCase().trim(),
                _id: { $ne: employee.user },
                isDeleted: { $ne: true }
            });

            if (existingEmailUser) {
                throw new ApiError(400, "This email is already used!");
            }
        }

        // Check duplicate phone number
        if (data.number) {
            const numberQuery = {
                number: data.number,
                _id: { $ne: employee.user },
                isDeleted: { $ne: true }
            };
            if (data.countryCode) {
                numberQuery.countryCode = data.countryCode;
            }

            const existingUser = await userModel.findOne(numberQuery);

            if (existingUser) {
                throw new ApiError(400, "This number is already used!");
            }
        } else if (data.phone) {
            const existingPhoneUser = await userModel.findOne({
                $or: [
                    { number: data.phone },
                    { phone: data.phone }
                ],
                _id: { $ne: employee.user },
                isDeleted: { $ne: true }
            });

            if (existingPhoneUser) {
                throw new ApiError(400, "This phone number is already used!");
            }
        }

        // Update User
        const userUpdate = {};

        if (data.name) userUpdate.fullName = data.name;
        if (data.email !== undefined) userUpdate.email = data.email ? data.email.toLowerCase().trim() : data.email;
        if (data.number !== undefined) userUpdate.number = data.number;
        if (data.countryCode !== undefined) userUpdate.countryCode = data.countryCode;

        if (Object.keys(userUpdate).length > 0) {
            await userModel.findByIdAndUpdate(
                employee.user,
                userUpdate,
                { new: true, session }
            );
        }

        // Update employee phone & email
        if (data.number && data.countryCode) {
            data.phone = `${data.countryCode}${data.number}`;
        }
        if (data.email) {
            data.email = data.email.toLowerCase().trim();
        }

        // Update Employee
        const updatedEmployee = await employeeModel.findByIdAndUpdate(
            id,
            data,
            { new: true, session }
        );

        await session.commitTransaction();

        return updatedEmployee;

    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        await session.endSession();
    }
};


const deleteEmployeeService = async (id, performedBy) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const employee = await employeeModel.findById(id).session(session);

        if (!employee) {
            throw new Error("Employee not found");
        }
        await employeeModel.findByIdAndDelete(id, { session });
        const employer = await employerModel
            .findById(employee.company)
            .session(session);

        if (employer) {
            employer.employeeCount = Math.max(
                0,
                employer.employeeCount - 1
            );
            await employer.save({ session });
        }

        const employeeUser = await userModel
            .findById(employee.user)
            .session(session);
        // console.log({ employeeUser });

        if (employeeUser) {
            employeeUser.email = `deleted_${Date.now()}_${employeeUser.email}`;
            employeeUser.isDeleted = true;

            await employeeUser.save({ session });
        }

        await addAuditReport(
            {
                action: "Delete",
                summary: `Employee ${employee.name} deleted`,
                performedBy,
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return employee;

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
};


module.exports = {
    addEmployeeService,
    getEmployeeService,
    getAllEmployeeService,
    editEmployeeService,
    deleteEmployeeService,
    activeEmployeeService,
    suspendEmployeeService,
    getCompanyAllEmployeeService,
    flagEmployeeService,
    allocateCreditEmployeeService,
    addNoteService,
    bulkSuspendEmployeeService,
    bulkActiveEmployeeService,
    bulkFlagEmployeeService,
    bulkAddNoteService,
    bulkAllocateCreditEmployeeService,
    reclaimCreditEmployeeService,
    bulkReclaimCreditEmployeeService
}