const { log } = require("winston");
const ApiError = require("../../helpers/ApiError");
const { addUser } = require("../Auth/auth.service");
const employerModel = require("../Employer/employer.model");
const userModel = require("../User/user.model");
const { userDeleteByIdService } = require("../User/user.service");
const adminModel = require("./admin.model");
const mongoose = require("mongoose");


const addAdminService = async (data) => {
    // console.log("::::::::::::::::::::",{ data });
    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        const user = await addUser(
            {
                fullName: data.fullName,
                email: data.email,
                password: process.env.DEFAULT_PASSWORD,
                role: data.role,
                // categoryPermissions: data.categoryPermissions,
            },
            { session }
        );
        data.user = user._id;
        if (data.role === 'hr' || data.role === 'sub_hr_admin') {
            const company = await employerModel.findOne({ email: data.email });
            if (company) {
                throw new ApiError(409, 'This email already used!')
            }
            console.log(data.loginUser, "data.loginUser");
            if (data.role === 'sub_hr_admin') {
                const companydata = await employerModel.findOne({
                    user: { $in: [data.loginUser] }
                });
                console.log({ companydata });
                await employerModel.findByIdAndUpdate(
                    companydata._id,
                    {
                        $push: {
                            user: user._id
                        }
                    },
                    { session }
                );
            }
            data.createdBy = data.loginUser;
            data.parent = data.loginUser;
            data.role = data.role;
        }
        await adminModel.create([data], { session });
        await session.commitTransaction();
        session.endSession();

        return user;

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
};

const deleteAdminService = async (id) => {

    const user = await userModel.findById(id);
    let updatedEmail = user.email;

    if (user.email) {
        updatedEmail = `deleted_${Date.now()}_${user.email}`;
    }

    const deletedUser = await userModel.findByIdAndUpdate(
        id,
        {
            isDeleted: true,
            email: updatedEmail,
        },
        { new: true }
    );

    await adminModel.findOneAndDelete({ user: id });

    return deletedUser;
};


const editAdminService = async (id, data) => {
    const admin = await adminModel.findById(id);
    if (!admin) {
        throw new ApiError(404, 'Admin not found');
    }

    if (data.categoryPermissions) {
        // Replace existing permissions with the new array
        admin.categoryPermissions = data.categoryPermissions;
    }
    await admin.save();
    return admin;
};




const allAdminService = async (options, filter) => {
    const { page = 1, limit = 10 } = options;
    const [result, totalResults] = await Promise.all([
        adminModel.aggregate([
            { $match: filter },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    fullName: '$userInfo.fullName',
                    image: '$userInfo.image',
                    email: '$userInfo.email',
                    active: { $not: ['$userInfo.isBan'] },
                    categoryPermissions: 1,
                    userId: '$userInfo._id'
                }
            }
        ]),
        adminModel.countDocuments(filter)
    ])

    return {
        result,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit
        }
    }
}


const getAdminByUserId = async (id) => {
    return adminModel.findOne({ user: id })
}

const suspendAdminService = async (id) => {
    await adminModel.findOneAndUpdate({ user: id }, { isBan: true });
    const user = await userModel.findById(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    user.isBan = true;
    await user.save();
    return user;
};

const activateAdminService = async (id) => {
    await adminModel.findOneAndUpdate({ user: id }, { isBan: false });
    const user = await userModel.findById(id);
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    user.isBan = false;
    await user.save();
    return user;
};

module.exports = {
    addAdminService,
    getAdminByUserId,
    editAdminService,
    deleteAdminService,
    allAdminService,
    suspendAdminService,
    activateAdminService
}
