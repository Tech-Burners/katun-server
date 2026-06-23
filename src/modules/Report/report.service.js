const serviceModel = require("../Service/service.model");
const reportModel = require("./report.model");
const { default: mongoose } = require("mongoose");


const addReportService = async (data) => {
    if (data.service) {
        const service = await serviceModel.findById(data.service).select('user');
        data.targetUser = service.user;
    }
    return reportModel.create(data)
}


const reportCountService = async () => {
  const result = await reportModel.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    }
  ]);

  // default structure (optional but recommended)
  const formatted = {
    opened: 0,
    resolved: 0,
    "high-priority": 0,
    investigation: 0
  };

  result.forEach(item => {
    formatted[item._id] = item.count;
  });

  return formatted;
};


const getAllReportService = async (options) => {
    const { search = "", status } = options;
    const { page = 1, limit = 10 } = options;

    const skip = (page - 1) * limit;

    const searchMatch = search
        ? {
              $or: [
                  {
                      "ReporterData.fullName": {
                          $regex: search,
                          $options: "i",
                      },
                  },
                  {
                      "targetUserData.fullName": {
                          $regex: search,
                          $options: "i",
                      },
                  },
              ],
          }
        : {};
    const statusMatch = status ? { status: status } : {};

    const aggregation = [
        {
            $lookup: {
                from: "users",
                localField: "reporter",
                foreignField: "_id",
                as: "ReporterData",
            },
        },
        {
            $unwind: {
                path: "$ReporterData",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "targetUser",
                foreignField: "_id",
                as: "targetUserData",
            },
        },
        {
            $unwind: {
                path: "$targetUserData",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $match: {
                ...searchMatch,
                ...statusMatch,
            },
        },

        { $sort: { createdAt: -1 } },

        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            reporterName: "$ReporterData.fullName",
                            reporterRole: "$ReporterData.role",
                            reporterPhoneNumber: "$ReporterData.phoneNumber",
                            targetUserName: "$targetUserData.fullName",
                            targetUserPhoneNumber: "$targetUserData.phoneNumber",
                            targetUserRole: "$targetUserData.role",
                            reason: 1,
                            details: 1,
                            status: 1,
                            createdAt: 1,
                        },
                    },
                ],
                totalCount: [{ $count: "total" }],
            },
        },
    ];

    const result = await reportModel.aggregate(aggregation);

    const results = result[0].data;
    const totalResults = result[0].totalCount[0]?.total || 0;

    return {
        result: results,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit,
        },
    };
};



const reportDetailsService = async (reportId) => {
    return reportModel.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(String(reportId)) } },
        {
            $lookup: {
                from: 'users',
                localField: 'reporter',
                foreignField: '_id',
                as: 'ReporterData'
            }
        },
        {
            $unwind: {
                path: '$ReporterData',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'targetUser',
                foreignField: '_id',
                as: 'targetUserData'
            }
        },
        {
            $unwind: {
                path: '$targetUserData',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                reporterName: '$ReporterData.fullName',
                reporterEmail: '$ReporterData.email',
                reporterPhoneNumber: '$ReporterData.phoneNumber',
                reporterId: '$ReporterData._id',
                targetUserId: '$targetUserData._id',
                targetUserName: '$targetUserData.fullName',
                targetUserEmail: '$targetUserData.email',
                targetUserPhoneNumber: '$targetUserData.phoneNumber',
                details: 1,
                reason: 1,
                isSolved: 1,
                createdAt: 1
            }
        }
    ])
}



const reportStatusUpdateService = async (reportId, status) => {
    return await reportModel.findByIdAndUpdate(reportId, { status: status }, { new: true });
}


module.exports = { addReportService, getAllReportService, reportStatusUpdateService, reportDetailsService, reportCountService };