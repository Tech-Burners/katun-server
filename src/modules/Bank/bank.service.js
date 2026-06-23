const ApiError = require("../../helpers/ApiError");
const bankModel = require("./bank.model");

const upsertBankService = async (data) => {

    if (data.isManual === false) {

        const existingAutoBank = await bankModel.findOne({
            user: data.user,
            isManual: false
        });

        // If auto bank exists → update it
        if (existingAutoBank) {
            return await bankModel.findByIdAndUpdate(
                existingAutoBank._id,
                data,
                { new: true }
            );
        }

        // If not exists → create
        return await bankModel.create(data);
    }

    return await bankModel.create(data);
};


const getAllRequestedbankService = async (options) => {
    const { page = 1, limit = 10 } = options;
    const skip = (page - 1) * limit;

    const result = await bankModel.aggregate([
        { $match: { isManual: true } },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },
        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                bank_name: 1,
                account_name: 1,
                account_number: 1,
                bankNotListed: 1,
                createdAt: 1,
                requestedBy: "$userData.fullName",
                email: "$userData.email"
            }
        }
    ]);

    const totalResults = await bankModel.countDocuments();

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


const getMybankService = async (user) => {
    return await bankModel.findOne({ user: user, isManual: false });
}

const deleteBankService = async (id) => {
    return await bankModel.findByIdAndDelete(id);
}

module.exports = {
    upsertBankService,
    getAllRequestedbankService,
    getMybankService,
    deleteBankService,
}