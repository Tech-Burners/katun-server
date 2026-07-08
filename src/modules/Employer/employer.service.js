const { default: mongoose, get } = require("mongoose");
const employerModel = require("./employer.model");
const ApiError = require("../../helpers/ApiError");
const { default: status } = require("http-status");
const { getUserByEmail, addUser, updateUserById } = require("../Auth/auth.service");
const { sendSMSINNumber } = require("../../helpers/sms");
const userModel = require("../User/user.model");
const { addAuditReport } = require("../Audit/audit.service");

const addEmployerService = async (data) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const existingUser = await getUserByEmail(data.email);
        if (existingUser) throw new ApiError(status.CONFLICT, 'This email already used!')
        const user = await addUser({
            email: data.email,
            password: process.env.DEFAULT_PASSWORD,
            role: "hr",
            fullName: data.contactName
        }, session)
        data.user = user._id;
        const employer = await employerModel.create([data], { session });
        await session.commitTransaction();
        session.endSession();
        return employer[0];
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
};

const editEmployerService = async (id, data) => {
    return await employerModel.findByIdAndUpdate(id, data, { new: true });
};

const deleteEmployerService = async (id, performedBy) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const employer = await employerModel.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new: true, session }
        );

        if (!employer) {
            throw new Error("Employer not found");
        }
        const userData = await userModel
            .findById(employer.user)
            .session(session);

        if (userData) {
            userData.isDeleted = true;
            userData.email = `deleted_${Date.now()}_${userData.email}`;

            await userData.save({ session });
        }

        await addAuditReport(
            {
                action: "Delete",
                summary: `Employer ${employer.companyName} has been Deleted`,
                performedBy,
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return employer;

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};


const getEmployerService = async (id) => {
    const result = await employerModel.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(String(id)),
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user",
            },
        },
        {
            $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true,
            }
        },

        {
            $addFields: {
                utilizationRate: {
                    $round: [
                        {
                            $cond: [
                                { $eq: ["$totalFunded", 0] },
                                0,
                                {
                                    $multiply: [
                                        { $divide: ["$totalSpent", "$totalFunded"] },
                                        100
                                    ]
                                }
                            ]
                        },
                        2
                    ]
                }
            }
        },
        {
            $project: {
                _id: 1,
                companyName: 1,
                industry: 1,
                contactName: 1,
                email: 1,
                creditBalance: 1,
                totalSpent: 1,
                totalFunded: 1,
                utilizationRate: 1,
                employeeCount: 1,
                activeEmployeeCount: 1,
                status: 1,
                number: "$user.number",
                countryCode: "$user.countryCode",
                flag: "$user.flagCount",
                note: "$user.note",
                address: "$user.address",
                whatsapp: "$user.whatsapp",
                createdAt: 1
            },
        }
    ])
    return result[0];
};


const allocateCreditEmployerService = async (employerId, data) => {

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // 1️⃣ Update credit atomically
        const employer = await employerModel.findByIdAndUpdate(
            employerId,
            { $inc: { creditBalance: data.amount } },
            { new: true, session }
        );

        if (!employer) {
            throw new Error("Employer not found");
        }

        // 2️⃣ Add audit log
        await addAuditReport(
            {
                action: "allocate",
                summary: `credit allocated to ${employer.companyName}`,
                performedBy: data.performedBy
            },
            session // ✅ VERY IMPORTANT
        );

        // 3️⃣ Commit
        await session.commitTransaction();
        session.endSession();

        return employer;

    } catch (error) {

        await session.abortTransaction();
        session.endSession();

        throw error;
    }
};


const noteToEmployerService = async(employerId, data) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const employer = await employerModel.findById(employerId).session(session);
        if(!employer) throw new Error("Employer not found");
        const userData = await userModel.findByIdAndUpdate(employer.user, { note: data.note }, { new: true, session });
        await addAuditReport({
            action: "Note",
            summary: `Employer ${userData.fullName} added note`,
            performedBy: data.performedBy
        })
        await session.commitTransaction();
        session.endSession();
        return employer;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
    
}

const flagEmployerService = async (employerId, performedBy) => {

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const employer = await employerModel
            .findById(employerId)
            .select('user')
            .session(session);

        if (!employer) {
            throw new Error("Employer not found");
        }

        const userData = await userModel
            .findById(employer.user)
            .session(session);

        if (!userData) {
            throw new Error("User not found");
        }

        userData.flagCount = (userData.flagCount || 0) + 1;
        await userData.save({ session });

        await addAuditReport(
            {
                action: "Flag",
                summary: `Employer ${userData.fullName} get a flag.`,
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

const suspendEmployerService = async (id, user) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await employerModel.findByIdAndUpdate(id, { status: "suspended" }, { new: true }, { session });
        await userModel.findByIdAndUpdate(result.user, { isBan: true }, { session });
        await addAuditReport({
            action: "Suspend",
            summary: `Employer ${result.companyName} has been suspended.`,
            performedBy: user
        }, { session });
        await session.commitTransaction();
        session.endSession();
        return result;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
}


const activeEmployerService = async (id, user) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await employerModel.findByIdAndUpdate(id, { status: "active" }, { new: true }, { session });
        await userModel.findByIdAndUpdate(result.user, { isBan: false }, { session });
        await addAuditReport({
            action: "Activate",
            summary: `Employer ${result.companyName} has been activated.`,
            performedBy: user
        }, { session });
        await session.commitTransaction();
        session.endSession();
        return result;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
}


const allocateCreditService = async (userId, data) => {

    const response = await updateUserById(
        userId,
        { $inc: { wallet: data.amount } },
        { new: true }
    );

    const user = response.user;

    if (user && data.amount > 0) {
        user.wallet += data.amount;
        // await sendSMSINNumber(
        //     user.phoneNumber,
        //     `Your wallet has been credited with ${data.amount} points. Your new balance is ${user.wallet} points.`,
        //     "wallet-credit" 
        // );
    }

    return user;
};

const getAllEmployerService = async (options, filter) => {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const employer = await employerModel.aggregate([
        {
            $match: {
                ...filter,
                isDeleted: false
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userInfo"
            }
        },
        { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
        { $match: { $or: [{ "userInfo.isDeleted": false }, { "userInfo": null }] } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
            $project: {
                _id: 1,
                companyName: 1,
                industry: 1,
                contactName: 1,
                email: 1,
                creditBalance: 1,
                totalSpent: 1,
                employeeCount: 1,
                status: 1,
                number: "$userInfo.number",
                countryCode: "$userInfo.countryCode",
                whatsapp: "$userInfo.whatsapp",
                createdAt: 1
            }
        }
    ]);

    const totalResultsAggregation = await employerModel.aggregate([
        { $match: { ...filter, isDeleted: false } },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userInfo"
            }
        },
        { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
        { $match: { $or: [{ "userInfo.isDeleted": false }, { "userInfo": null }] } },
        { $count: "totalResults" }
    ]);
    const totalResults = totalResultsAggregation[0]?.totalResults || 0;

    return {
        employer,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit
        }
    };
};


module.exports = {
    addEmployerService,
    editEmployerService,
    deleteEmployerService,
    getEmployerService,
    getAllEmployerService,
    suspendEmployerService,
    activeEmployerService,
    allocateCreditService,
    flagEmployerService,
    allocateCreditEmployerService,
    noteToEmployerService
};