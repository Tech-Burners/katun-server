const ApiError = require("../../helpers/ApiError");
const resolveCompanyId = require("../../helpers/resolveCompanyId");
const adminModel = require("../Admin/admin.model");
const { addAuditReport } = require("../Audit/audit.service");
const { updateUserById } = require("../Auth/auth.service");
const employerModel = require("../Employer/employer.model");
const userModel = require("../User/user.model");
const employeeModel = require("./employee.model");
const mongoose = require("mongoose");

const addEmployeeService = async (data) => {

    if (data.phone) {
        const existingUser = await userModel.findOne({
            phoneNumber: data.phone
        });

        if (existingUser) {
            throw new ApiError(400, 'This number already used!');
        }
    }

    const session = await mongoose.startSession();

    try {

        session.startTransaction();

        // ✅ Create User
        const user = await userModel.create([{
            fullName: data.name,
            phoneNumber: data.phone,
            password: process.env.DEFAULT_PASSWORD,
        }], { session });

        data.user = user[0]._id;

        // ✅ Create Employee
        const employee = await employeeModel.create([data], { session });

        // ✅ Get Employer safely
        const employer = await employerModel
            .findById(data.company)
            .session(session);

        if (!employer) {
            throw new ApiError(404, 'Employer not found');
        }

        // ✅ Update counts safely
        employer.employeeCount = (employer.employeeCount || 0) + 1;
        employer.activeEmployeeCount =
            (employer.activeEmployeeCount || 0) + 1;

        await employer.save({ session });

        await session.commitTransaction();

        return employee[0];

    } catch (err) {

        await session.abortTransaction();
        throw err;

    } finally {
        session.endSession();
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
                createdAt: 1,
                userType: "$user.role",
                isBan: "$user.isBan",
                wallet: "$user.digitalWallet",
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
                "user.fullName": { $regex: search, $options: "i" }
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
                            // wallet : "$user.wallet",
                            // usages: "$user.usages",
                            phoneNumber: "$user.phoneNumber",
                            // departmentName: "$department.name",
                            // branchname: "$branch.name",
                            // totalUseage: "$usages",
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
                "user.fullName": { $regex: search, $options: "i" }
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
                            phoneNumber: "$user.phoneNumber",
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
        console.log({ userData });
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


const allocateCreditEmployeeService = async (employeeId, data) => {
    console.log({ data });
    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        let company;
        if (data.role === 'hr') {
            console.log("hr")
            company = await employerModel.findOne({ user: data.performedBy })
            console.log({ company })
        } else if (data.role === 'sub_hr_admin') {
            console.log("sub_hr_admin")
            const parent = await adminModel.findOne({ user: data.performedBy })
            console.log({ parent })
            company = await employerModel.findOne({ user: parent.parent })
            console.log({ company })
        }
        if (company.creditBalance < data.amount) {
            throw new ApiError(412, "Insufficient balance")
        } else {
            company.creditBalance -= data.amount
        }
        company.save()

        const employee = await employeeModel
            .findById(employeeId)
            .select('user')
            .session(session);

        if (!employee) {
            throw new Error("Employee not found");
        }

        const userData = await userModel.findByIdAndUpdate(
            employee.user,
            { $inc: { digitalWallet: data.amount } },
            { new: true, session }
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


const flagEmployeeService = async (employeeId, performedBy) => {

    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        const emply = await employeeModel.findById(employeeId).select("user");
        console.log({ emply })
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


const suspendEmployeeService = async (id, user) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await employeeModel.findByIdAndUpdate(id, { status: "suspended" }, { new: true }, { session });
        console.log({ result });
        await userModel.findByIdAndUpdate(result.user, { isBan: true }, { session });
        await addAuditReport({
            action: "Suspend",
            summary: `Employee ${result.name} suspended`,
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



const activeEmployeeService = async (id, user) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await employeeModel.findByIdAndUpdate(id, { status: "active" }, { new: true }, { session });
        console.log({ result });
        await userModel.findByIdAndUpdate(result.user, { isBan: false }, { session });
        await addAuditReport({
            action: "Activate",
            summary: `Employee ${result.name} activated`,
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


const editEmployeeService = async (id, data) => {
    return await employeeModel.findByIdAndUpdate(id, data, { new: true });
}


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
        console.log({ employeeUser });

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
    addNoteService
}