const { default: mongoose } = require("mongoose");
const userModel = require("../User/user.model");
const partnerModel = require("./partner.model");
const bookingModel = require("../Booking/booking.model");
const transactionModel = require("../Transaction/transaction.model");
const { emailWithNodemailer } = require("../../helpers/email");
const ApiError = require("../../helpers/ApiError");
const { default: status } = require("http-status");
const { addAuditReport } = require("../Audit/audit.service");




const addPartnerService = async (data) => {
    return await partnerModel.create(data);
};


const myDocumentsService = async (userId) => {
    // console.log({ userId });

    const result = await partnerModel
        .findOne({ user: userId })
        .select('bankStatement businessCertification identityProof certificate');

    return result;
};


const suspendPartnerService = async (id, user) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await partnerModel.findByIdAndUpdate(id, { isBan: true }, { new: true }, { session });
        const userData = await userModel.findByIdAndUpdate(result.user, { isBan: true }, { session });
        await addAuditReport({
            action: "Suspended",
            summary: `partner ${userData.fullName} Suspended `,
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


const bulkSuspendPartnerService = async (partnerIds, adminId) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Get partners with their linked users
    const partners = await partnerModel
      .find({ _id: { $in: partnerIds } })
      .populate("user", "fullName")
      .session(session);

    // Suspend partners
    await partnerModel.updateMany(
      { _id: { $in: partnerIds } },
      { $set: { isBan: true } },
      { session }
    );

    // Suspend linked users
    const userIds = partners.map((partner) => partner.user._id);

    await userModel.updateMany(
      { _id: { $in: userIds } },
      { $set: { isBan: true } },
      { session }
    );

    // Create audit logs
    await Promise.all(
      partners.map((partner) =>
        addAuditReport(
          {
            action: "Suspended",
            summary: `Partner ${partner.user.fullName} suspended`,
            performedBy: adminId,
          },
          { session }
        )
      )
    );

    await session.commitTransaction();

    return {
      modifiedCount: partners.length,
      partners: partners.map((partner) => ({
        id: partner._id,
        businessName: partner.businessName,
      })),
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};


const giveFlagService = async (id, user) => {
    const userData = await partnerModel.findById(id).populate('user')
    // console.log({userData})
    const result = await userModel.findByIdAndUpdate(userData.user, { $inc: { flagCount: 1 } }, { new: true });
    await addAuditReport({
            action: "Flag",
            summary: `Partner ${userData.businessName} get a flag `,
            performedBy: user
        });
    return result;
}


const bulkGiveFlagService = async (partnerIds, adminId) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Get partners with linked users
    const partners = await partnerModel
      .find({
        _id: { $in: partnerIds },
        isDeleted: false,
      })
      .populate("user", "fullName")
      .session(session);

    // Increment flag count for all linked users
    const userIds = partners.map((partner) => partner.user._id);

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

    // Audit logs
    await Promise.all(
      partners.map((partner) =>
        addAuditReport(
          {
            action: "Flag",
            summary: `Partner ${partner.businessName} got a flag`,
            performedBy: adminId,
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


const giveNoteService = async (partnerId, data) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!data?.note) {
      throw new Error("Note is required");
    }

    if (!data?.performedBy) {
      throw new Error("performedBy is required");
    }

 
    const partner = await partnerModel
      .findById(partnerId)
      .populate("user")
      .session(session);

    if (!partner) {
      throw new Error("Partner not found");
    }

  
    const updatedUser = await userModel.findByIdAndUpdate(
      partner.user._id,
      { $set: { note: data.note } },
      { new: true, runValidators: true, session }
    );

    await addAuditReport({
      action: "Note",
      summary: `Note added for partner ${partner.businessName}`,
      performedBy: data.performedBy,
      company: partner.company || null
    });

    await session.commitTransaction();
    session.endSession();

    return updatedUser;

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    throw error;
  }
};


const bulkGiveNoteService = async (partnerIds, note, performedBy) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const partners = await partnerModel
      .find({
        _id: { $in: partnerIds },
        isDeleted: false,
      })
      .populate("user")
      .session(session);

    if (!partners.length) {
      throw new Error("No partners found");
    }

    const userIds = partners.map((partner) => partner.user._id);

    const result = await userModel.updateMany(
      {
        _id: { $in: userIds },
      },
      {
        $set: {
          note,
        },
      },
      { session }
    );

    await Promise.all(
      partners.map((partner) =>
        addAuditReport(
          {
            action: "Note",
            summary: `Note added for partner ${partner.businessName}`,
            performedBy,
            company: partner.company || null,
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

const activePartnerService = async (id, user) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await partnerModel.findByIdAndUpdate(id, { isBan: false }, { new: true }, { session });
        const userData = await userModel.findByIdAndUpdate(result.user, { isBan: false }, { session });
        await addAuditReport({
            action: "Activate",
            summary: `Partner ${userData.fullName} activated`,
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


const bulkActivePartnerService = async (partnerIds, adminId) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Get partners with linked users
    const partners = await partnerModel
      .find({
        _id: { $in: partnerIds },
        isDeleted: false,
      })
      .populate("user", "fullName")
      .session(session);

    // Activate partners
    await partnerModel.updateMany(
      {
        _id: { $in: partnerIds },
      },
      {
        $set: {
          isBan: false,
        },
      },
      { session }
    );

    // Activate users
    const userIds = partners.map((partner) => partner.user._id);

    await userModel.updateMany(
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

    // Audit logs
    await Promise.all(
      partners.map((partner) =>
        addAuditReport(
          {
            action: "Activate",
            summary: `Partner ${partner.user.fullName} activated`,
            performedBy: adminId,
          },
          { session }
        )
      )
    );

    await session.commitTransaction();

    return {
      modifiedCount: partners.length,
      partners: partners.map((partner) => ({
        id: partner._id,
        businessName: partner.businessName,
      })),
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};


const approvePartnerService = async (id, user) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await partnerModel.findByIdAndUpdate(id, { isVerified: true }, { new: true, session });
        if (!result) {
            throw new Error("Partner not found");
        }
        const userData = await userModel.findByIdAndUpdate(result.user, { isVerified: true }, { new: true, session });
        await addAuditReport({
            action: "Approve",
            summary: `Partner ${userData?.fullName || result.businessName || 'Partner'} Approved `,
            performedBy: user
        }, { session });
        await session.commitTransaction();
        session.endSession();

        if (userData?.email) {
            await emailWithNodemailer({
                email: userData.email,
                subject: "Partner Application Approved",
                html: `
                    <h3>Congratulations! Your Partner Account is Approved</h3>
                    <p>Hello ${userData.fullName || result.businessName || "Partner"},</p>
                    <p>We are pleased to inform you that your partner application for <strong>${result.businessName || "Aura Vive"}</strong> has been approved.</p>
                    <p>You can now log in to your dashboard, manage your services, and start accepting bookings.</p>
                    <p>Thank you for partnering with us!</p>
                `,
            }).catch((e) => console.error("Partner approval email error:", e.message));
        }

        return result;
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
}


const bulkApprovePartnerService = async (partnerIds, adminId) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Get partners with linked users
    const partners = await partnerModel
      .find({
        _id: { $in: partnerIds },
        isDeleted: false,
      })
      .populate("user", "fullName email")
      .session(session);

    if (!partners.length) {
      throw new Error("No partners found");
    }

    // Approve partners
    await partnerModel.updateMany(
      {
        _id: { $in: partnerIds },
      },
      {
        $set: {
          isVerified: true,
        },
      },
      { session }
    );

    // Approve linked users
    const userIds = partners.map((partner) => partner.user?._id).filter(Boolean);

    const userResult = await userModel.updateMany(
      {
        _id: { $in: userIds },
      },
      {
        $set: {
          isVerified: true,
        },
      },
      { session }
    );

    // Audit logs
    await Promise.all(
      partners.map((partner) =>
        addAuditReport(
          {
            action: "Approve",
            summary: `Partner ${partner.user?.fullName || partner.businessName || 'Partner'} Approved`,
            performedBy: adminId,
          },
          { session }
        )
      )
    );

    await session.commitTransaction();

    // Send approval emails after transaction commits
    await Promise.all(
      partners.map(async (partner) => {
        if (partner.user?.email) {
          await emailWithNodemailer({
            email: partner.user.email,
            subject: "Partner Application Approved",
            html: `
              <h3>Congratulations! Your Partner Account is Approved</h3>
              <p>Hello ${partner.user.fullName || partner.businessName || "Partner"},</p>
              <p>We are pleased to inform you that your partner application for <strong>${partner.businessName || "Aura Vive"}</strong> has been approved.</p>
              <p>You can now log in to your dashboard, manage your services, and start accepting bookings.</p>
              <p>Thank you for partnering with us!</p>
            `,
          }).catch((e) => console.error("Bulk partner approval email error:", e.message));
        }
      })
    );

    return {
      matchedCount: userResult.matchedCount,
      modifiedCount: userResult.modifiedCount,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};


const updatePartnerService = async (id, data) => {
    return await partnerModel.findByOneAndUpdate({ user: id }, data, { new: true });
}


const aPartnerDetailsService = async (id, userId = null) => {

    let userCoordinates = null;

    // ---------- LOGIN USER LOCATION ----------
    if (userId) {
        const loginUser = await userModel
            .findById(userId)
            .select("location");

        if (
            loginUser?.location?.coordinates &&
            loginUser.location.coordinates.length === 2
        ) {
            userCoordinates = loginUser.location.coordinates;
        }
    }

    return await partnerModel.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(String(id)),
            },
        },

        // ---------- USER ----------
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData",
            },
        },
        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true,
            },
        },

        // ---------- PARTNER ----------
        {
            $lookup: {
                from: "partners",
                localField: "user",
                foreignField: "user",
                as: "partnerData",
            },
        },
        {
            $unwind: {
                path: "$partnerData",
                preserveNullAndEmptyArrays: true,
            },
        },

        // ---------- SERVICES ----------
        {
            $lookup: {
                from: "services",
                let: { userId: "$user" },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ["$user", "$$userId"] },
                        },
                    },

                    // subcategory
                    {
                        $lookup: {
                            from: "subcategories",
                            localField: "subCategory",
                            foreignField: "_id",
                            as: "subcategoryData",
                        },
                    },
                    {
                        $unwind: {
                            path: "$subcategoryData",
                            preserveNullAndEmptyArrays: true,
                        },
                    },

                    {
                        $project: {
                            _id: 1,
                            name: 1,
                            image: 1,
                            ratingCount: 1,
                            avgRating: 1,
                            servicefee: 1,
                            subcategoryName: "$subcategoryData.name",
                        },
                    },
                ],
                as: "services",
            },
        },

        // ================================
        // ✅ DISTANCE (ONLY ONCE HERE)
        // ================================
        ...(userCoordinates
            ? [
                {
                    $addFields: {
                        distance: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: ["$userData.location", null] },
                                        {
                                            $isArray: "$userData.location.coordinates",
                                        },
                                        {
                                            $eq: [
                                                {
                                                    $size: "$userData.location.coordinates",
                                                },
                                                2,
                                            ],
                                        },
                                    ],
                                },
                                {
                                    $sqrt: {
                                        $add: [
                                            {
                                                $pow: [
                                                    {
                                                        $subtract: [
                                                            {
                                                                $arrayElemAt: [
                                                                    "$userData.location.coordinates",
                                                                    0,
                                                                ],
                                                            },
                                                            userCoordinates[0],
                                                        ],
                                                    },
                                                    2,
                                                ],
                                            },
                                            {
                                                $pow: [
                                                    {
                                                        $subtract: [
                                                            {
                                                                $arrayElemAt: [
                                                                    "$userData.location.coordinates",
                                                                    1,
                                                                ],
                                                            },
                                                            userCoordinates[1],
                                                        ],
                                                    },
                                                    2,
                                                ],
                                            },
                                        ],
                                    },
                                },
                                null,
                            ],
                        },
                    },
                },
            ]
            : []),

        // ---------- FINAL OUTPUT ----------
        {
            $project: {
                businessName: 1,
                rating: 1,
                ratingCount: 1,
                location: "$userData.location",
                address: "$userData.address",
                number: "$userData.number",
                countryCode: "$userData.countryCode",
                image: "$userData.image",

                aboutUs: "$partnerData.aboutUs",

                services: 1,

                // ✅ provider distance (MAIN REQUIREMENT)
                distance: userCoordinates
                    ? { $round: ["$distance", 2] }
                    : null,
            },
        },
    ]);
};



const pendingPartnerForApprovalService = async (options) => {
    const { page = 1, limit = 10, search } = options;
    const skip = (page - 1) * limit;

    // search filter
    const searchMatch = search
        ? {
            $or: [
                { "userData.fullName": { $regex: search, $options: "i" } },
                { "userData.email": { $regex: search, $options: "i" } },
                { "userData.number": { $regex: search, $options: "i" } },
                { "categoryData.name": { $regex: search, $options: "i" } },
            ],
        }
        : {};

    const aggregation = [
        {
            $match: {
                isDeleted: false,
                isVerified: false
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData",
            },
        },
        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $match: {
                "userData.role": "partner",
            },
        },
        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "categoryData",
            },
        },
        {
            $unwind: {
                path: "$categoryData",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $match: searchMatch,
        },

        {
            $sort: { createdAt: -1 },
        },
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 1,
                            fullName: "$userData.fullName",
                            number: "$userData.number",
                            countryCode: "$userData.countryCode",
                            location: "$userData.location",
                            address: "$userData.address",
                            // whatsappNumber: "$userData.whatsappNumber",
                            email: "$userData.email",
                            categoryName: "$categoryData.name",
                            // location: 1,
                            // address: 1,
                            createdAt: 1,
                        },
                    },
                ],
                totalCount: [{ $count: "total" }],
            },
        },
    ];

    const result = await partnerModel.aggregate(aggregation);

    const data = result[0].data;
    const totalResults = result[0].totalCount[0]?.total || 0;

    return {
        result: data,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
        },
    };
};


const allPartnerService = async (options) => {
    const { page = 1, limit = 10, search, isBan } = options;
    const skip = (page - 1) * limit;

    const searchMatch = search
        ? {
            $or: [
                { "userData.fullName": { $regex: search, $options: "i" } },
                { "userData.email": { $regex: search, $options: "i" } },
                { "userData.number": { $regex: search, $options: "i" } },
                { "categoryData.name": { $regex: search, $options: "i" } }
            ],
        }
        : {};

    const banMatch =
        isBan !== undefined
            ? { "userData.isBan": isBan === "true" }
            : {};

    const aggregation = [
        {
            $match: {
                isDeleted: false
            },
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData",
            },
        },
        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true,
            },
        },
        {
            $match: {
                "userData.role": "partner",
                ...banMatch
            },
        },

        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "categoryData",
            },
        },
        {
            $unwind: {
                path: "$categoryData",
                preserveNullAndEmptyArrays: true,
            },
        },

        { $match: searchMatch },

        { $sort: { createdAt: -1 } },

        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 1,
                            fullName: "$userData.fullName",
                            Image: "$userData.image",
                            number: "$userData.number",
                            countryCode: "$userData.countryCode",
                            // whatsappNumber: "$userData.whatsappNumber",
                            email: "$userData.email",
                            categoryName: "$categoryData.name",
                            location: 1,
                            address: 1,
                            rating: 1,
                            isBanned: "$userData.isBan",
                            totalRevenue: "$userData.totalRevenue",
                            totalBookings: 1,
                            completeBookings: 1,
                            createdAt: 1,
                        },
                    },
                ],
                totalCount: [{ $count: "total" }],
            },
        },
    ];

    const result = await partnerModel.aggregate(aggregation);

    const data = result[0].data;
    const totalResults = result[0].totalCount[0]?.total || 0;

    return {
        result: data,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
        },
    };
};



const rejectProviderService = async (id, data) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {

        const partner = await partnerModel.findById(id).session(session);

        if (!partner) {
            throw new Error("Partner not found");
        }
        await partnerModel.findByIdAndDelete(id).session(session);
        const user = await userModel
            .findByIdAndDelete(partner.user)
            .session(session);

        await session.commitTransaction();
        session.endSession();

        if (user?.email) {
            await emailWithNodemailer({
                email: user.email,
                subject: "Partner Application Rejected",
                html: `
                    <h3>Application Rejected</h3>
                    <p>We regret to inform you that your partner application has been rejected.</p>
                    <p><strong>Reason:</strong> ${data.reason}</p>
                    <p>Please contact our support team for more information.</p>
                `,
            });
        }

        await addAuditReport({
            action: "Reject",
            summary: `Partner ${partner.businessName} Rejected `,
            performedBy: data.performedBy
        });

        return partner;

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
};


const bulkRejectProviderService = async (partnerIds, data) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const partners = await partnerModel
      .find({
        _id: { $in: partnerIds },
      })
      .populate("user")
      .session(session);

    if (!partners.length) {
      throw new Error("No partners found");
    }

    const userIds = partners.map((partner) => partner.user._id);

    // Delete partners
    await partnerModel.deleteMany(
      {
        _id: { $in: partnerIds },
      },
      { session }
    );

    // Delete users
    await userModel.deleteMany(
      {
        _id: { $in: userIds },
      },
      { session }
    );

    await session.commitTransaction();

    // Send rejection emails
    await Promise.all(
      partners.map(async (partner) => {
        if (partner.user?.email) {
          await emailWithNodemailer({
            email: partner.user.email,
            subject: "Partner Application Rejected",
            html: `
              <h3>Application Rejected</h3>
              <p>We regret to inform you that your partner application has been rejected.</p>
              <p><strong>Reason:</strong> ${data.reason}</p>
              <p>Please contact our support team for more information.</p>
            `,
          });
        }
      })
    );

    // Audit reports
    await Promise.all(
      partners.map((partner) =>
        addAuditReport({
          action: "Reject",
          summary: `Partner ${partner.businessName} Rejected`,
          performedBy: data.performedBy,
        })
      )
    );

    return {
      deletedCount: partners.length,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};


const detailsForAdminService = async (userId) => {
    return await partnerModel.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(String(userId))
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData",
            },
        },
        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true,
            },
        },

        {
            $lookup: {
                from: "categories",
                localField: "category",
                foreignField: "_id",
                as: "categoryData",
            },
        },
        {
            $unwind: {
                path: "$categoryData",
                preserveNullAndEmptyArrays: true,
            },
        },

        {
            $addFields: {
                completionRate: {
                    $cond: [
                        { $eq: ["$totalBookings", 0] },
                        0,
                        {
                            $round: [
                                {
                                    $multiply: [
                                        {
                                            $divide: [
                                                "$completeBookings",
                                                "$totalBookings"
                                            ]
                                        },
                                        100
                                    ]
                                },
                                2
                            ]
                        }
                    ]
                }
            }
        },

        {
            $project: {
                _id: 1,
                businessName: 1,
                fullName: "$userData.fullName",
                number: "$userData.number",
                countryCode: "$userData.countryCode",
                // whatsappNumber: "$userData.whatsappNumber",
                wallet: "$userData.wallet",
                image: "$userData.image",
                email: "$userData.email",
                note: "$userData.note",
                categoryName: "$categoryData.name",
                businessCertification: 1,
                identityProof: 1,
                rating: 1,
                totalBookings: 1,
                completeBookings: 1,
                completionRate: 1,
                isBan: 1,
                totalRevenue: "$userData.totalRevenue",
                reportCount: "$userData.reportCount",
                flagCount: "$userData.flagCount",
                certificate: 1,
                bankStatement: 1,
                location: 1,
                address: 1,
                createdAt: 1,
            }
        }
    ]);
};


const updateDocumentsService = async (id, data) => {
    return await partnerModel.findOneAndUpdate({ user: id }, data, { new: true });
}

const partnerDashboardService = async (userId, year = new Date().getFullYear()) => {
    try {
        // Get partner user object to extract partner ID
        const partner = await partnerModel.findOne({ user: userId });

        if (!partner) {
            throw new Error("Partner not found");
        }

        const partnerId = partner._id;
        const partnerUserId = partner.user;

        // Get user data for digital wallet
        const userData = await userModel.findById(partnerUserId).select('digitalWallet');

        // Count upcoming bookings (pending + approved)
        const upcomingBookings = await bookingModel.countDocuments({
            provider: partnerUserId,
            status: { $in: ['pending', 'approved'] }
        });

        // Count completed bookings
        const completedBookings = await bookingModel.countDocuments({
            provider: partnerUserId,
            status: 'completed'
        });

        // Booking trend over the year
        const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
        const endDate = new Date(`${year}-12-31T23:59:59.999Z`);
        const months = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];

        const bookingTrendAgg = await bookingModel.aggregate([
            {
                $match: {
                    provider: new mongoose.Types.ObjectId(partnerUserId),
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { month: { $month: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.month': 1 }
            }
        ]);

        const bookingTrend = months.map((month, index) => {
            const monthData = bookingTrendAgg.find(r => r._id.month === index + 1);
            return {
                month,
                bookings: monthData ? monthData.count : 0
            };
        });

        // Earnings trend over the year
        const earningTrendAgg = await transactionModel.aggregate([
            {
                $match: {
                    partner: new mongoose.Types.ObjectId(partnerUserId),
                    payment_status: 'successful',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { month: { $month: '$createdAt' } },
                    earnings: { $sum: '$net_amount' }
                }
            },
            {
                $sort: { '_id.month': 1 }
            }
        ]);

        const earningTrend = months.map((month, index) => {
            const monthData = earningTrendAgg.find(r => r._id.month === index + 1);
            return {
                month,
                earnings: monthData ? parseFloat(monthData.earnings.toFixed(2)) : 0
            };
        });

        // Get average rating and total rating from partner model
        const avgRating = partner.rating || 0;
        const totalRating = partner.totalRating || 0;

        // Get total earning (sum of net_amount from successful transactions)
        const earnings = await transactionModel.aggregate([
            {
                $match: {
                    partner: new mongoose.Types.ObjectId(partnerUserId),
                    payment_status: 'successful'
                }
            },
            {
                $group: {
                    _id: null,
                    totalEarning: { $sum: '$net_amount' }
                }
            }
        ]);

        const totalEarning = earnings[0]?.totalEarning || 0;

        // Count pending payouts
        const pendingPayouts = await transactionModel.countDocuments({
            partner: new mongoose.Types.ObjectId(partnerUserId),
            payout_status: 'pending',
            payment_status: 'successful'
        });

        // Sum pending payout amounts
        const pendingPayoutAmounts = await transactionModel.aggregate([
            {
                $match: {
                    partner: new mongoose.Types.ObjectId(partnerUserId),
                    payout_status: 'pending',
                    payment_status: 'successful'
                }
            },
            {
                $group: {
                    _id: null,
                    totalPendingAmount: { $sum: '$net_amount' }
                }
            }
        ]);

        const totalPendingPayoutAmount = pendingPayoutAmounts[0]?.totalPendingAmount || 0;

        return {
            upcomingBookings,
            completedBookings,
            bookingTrend,
            earningTrend,
            avgRating: parseFloat(avgRating.toFixed(2)),
            totalRating,
            totalEarning: parseFloat(totalEarning.toFixed(2)),
            pendingPayoutCount: pendingPayouts,
            pendingPayoutAmount: parseFloat(totalPendingPayoutAmount.toFixed(2)),
            digitalWallet: userData?.digitalWallet || 0
        };
    } catch (error) {
        throw error;
    }
};

module.exports = {
    addPartnerService,
    myDocumentsService,
    allPartnerService,
    pendingPartnerForApprovalService,
    detailsForAdminService,
    activePartnerService,
    suspendPartnerService,
    giveFlagService,
    giveNoteService,
    rejectProviderService,
    approvePartnerService,
    updatePartnerService,
    aPartnerDetailsService,
    updateDocumentsService,
    bulkSuspendPartnerService,
    partnerDashboardService,
    bulkApprovePartnerService,
    bulkActivePartnerService,
    bulkGiveFlagService,
    bulkGiveNoteService,
    bulkRejectProviderService
};