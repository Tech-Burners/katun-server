const { default: mongoose } = require('mongoose');
const AuditLog = require('./audit.model');

const addAuditReport = async (data) => {
    return AuditLog.create(data);
}


const getAuditLogsService = async (options, user) => {

    const {
        page = 1,
        limit = 10,
        search,
        action,
        performedBy,
        month,
        year
    } = options;

    const skip = (page - 1) * limit;

    /* ---------------- FILTER BUILDER ---------------- */

    const matchStage = {};

    // if (user.role === "hr" && user.company) {
    //     matchStage.company = new mongoose.Types.ObjectId(user.company);
    // }

    if (search) {
        matchStage.summary = {
            $regex: search,
            $options: "i"
        };
    }

    if (action) {
        matchStage.action = action;
    }

    if (performedBy) {
        matchStage.performedBy =
            new mongoose.Types.ObjectId(performedBy);
    }

    if (month || year) {

        const startDate = new Date(
            year || new Date().getFullYear(),
            month ? month - 1 : 0,
            1
        );

        const endDate = new Date(
            year || new Date().getFullYear(),
            month ? month : 12,
            1
        );

        matchStage.createdAt = {
            $gte: startDate,
            $lt: endDate
        };
    }

    const [logs, totalLogs] = await Promise.all([

        AuditLog.aggregate([
            { $match: matchStage },

            { $sort: { createdAt: -1 } },

            { $skip: skip },
            { $limit: limit },

            {
                $lookup: {
                    from: "users",
                    localField: "performedBy",
                    foreignField: "_id",
                    as: "performedByInfo"
                }
            },

            { $unwind: "$performedByInfo" },

            {
                $project: {
                    action: 1,
                    summary: 1,
                    createdAt: 1,
                    performedByName: "$performedByInfo.fullName",
                    performedByRole: "$performedByInfo.role",
                    performedById: "$performedByInfo._id"
                }
            }
        ]),

        AuditLog.countDocuments(matchStage)
    ]);

    return {
        logs,
        totalLogs,
        currentPage: page,
        totalPages: Math.ceil(totalLogs / limit)
    };
};

module.exports = { addAuditReport, getAuditLogsService };
