const { default: mongoose } = require("mongoose");
const promoModel = require("./promo.model");
const partnerModel = require("../Partner/partner.model");
const ApiError = require("../../helpers/ApiError");
const { default: status } = require("http-status");

const addPromoService = async (data) => {
    return await promoModel.create(data);
}

const editPromoService = async (id, data) => {
    return await promoModel.findByIdAndUpdate(id, data, { new: true });
}

const deletePromoService = async (id) => {
    return await promoModel.findByIdAndDelete(id);
}

const getPartnerPromoService = async (user, option) => {
    const { page, limit } = option;
    const skip = (page - 1) * limit;

    const result = await promoModel.aggregate([
        {
            $match: {
                createdBy: "partner",
                user: new mongoose.Types.ObjectId(String(user))
            }
        },
        {
            $sort: { createdAt: -1 } // optional but recommended
        },
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit }
                ],
                totalCount: [
                    { $count: "count" }
                ]
            }
        }
    ]);

    const promos = result[0].data;
    const totalResults = result[0].totalCount[0]?.count || 0;

    return {
        result: promos,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit
        }
    };
};

const getAdminPromoService = async (option) => {
    const { page, limit } = option;
    const skip = (page - 1) * limit;

    const result = await promoModel.aggregate([
        {
            $match: {
                createdBy: "admin"
            }
        },
        {
            $sort: { createdAt: -1 } // optional but recommended
        },
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit }
                ],
                totalCount: [
                    { $count: "count" }
                ]
            }
        }
    ]);

    const promos = result[0].data;
    const totalResults = result[0].totalCount[0]?.count || 0;

    return {
        result: promos,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: page,
            limit
        }
    };
};

const getCouponsByPartnerService = async (partnerId, options = {}) => {
    const { page = 1, limit = 10, status, search } = options;
    const skip = (page - 1) * limit;

    if (!partnerId || !mongoose.Types.ObjectId.isValid(partnerId)) {
        throw new ApiError(status.BAD_REQUEST, "Invalid partner ID");
    }

    const objectId = new mongoose.Types.ObjectId(String(partnerId));
    let targetUserIds = [];

    // 1. Check if partnerId is a partner document _id in partners collection
    const partnerDoc = await partnerModel.findById(objectId).select("user");
    if (partnerDoc?.user) {
        targetUserIds.push(partnerDoc.user);
    }

    // 2. Check if partnerId is already a user _id in partners collection
    const partnerByUser = await partnerModel.findOne({ user: objectId }).select("user");
    if (partnerByUser?.user) {
        targetUserIds.push(partnerByUser.user);
    }

    // 3. Fallback: also include the raw ID itself
    targetUserIds.push(objectId);

    // Deduplicate IDs
    const uniqueUserIds = [
        ...new Map(targetUserIds.map((id) => [String(id), id])).values(),
    ];

    const matchQuery = {
        user: { $in: uniqueUserIds },
    };

    if (status) {
        matchQuery.status = status;
    }

    if (search && search.trim() !== "") {
        matchQuery.$or = [
            { code: { $regex: search, $options: "i" } },
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
        ];
    }

    const aggregation = [
        { $match: matchQuery },
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
        { $sort: { createdAt: -1 } },
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: Number(limit) },
                    {
                        $project: {
                            _id: 1,
                            code: 1,
                            name: 1,
                            description: 1,
                            discount: 1,
                            minspend: 1,
                            usageLimit: 1,
                            validForm: 1,
                            validTo: 1,
                            eligiblity: 1,
                            status: 1,
                            image: 1,
                            createdBy: 1,
                            user: 1,
                            partnerId: "$partnerData._id",
                            partnerName: "$partnerData.businessName",
                            createdAt: 1,
                            updatedAt: 1,
                        },
                    },
                ],
                totalCount: [{ $count: "count" }],
            },
        },
    ];

    const result = await promoModel.aggregate(aggregation);

    const promos = result[0]?.data || [];
    const totalResults = result[0]?.totalCount[0]?.count || 0;

    return {
        result: promos,
        pagination: {
            totalResults,
            totalPages: Math.ceil(totalResults / limit),
            currentPage: Number(page),
            limit: Number(limit),
        },
    };
};

const verifyCouponService = async ({ code, partnerId, amount, userId, userRole }) => {
    if (!code || typeof code !== "string" || code.trim() === "") {
        throw new ApiError(status.BAD_REQUEST, "Coupon code is required");
    }

    const trimmedCode = code.trim();

    // 1. Case-insensitive search for promo by code
    const promo = await promoModel.findOne({
        code: { $regex: new RegExp(`^${trimmedCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });

    if (!promo) {
        throw new ApiError(status.NOT_FOUND, "Invalid coupon code");
    }

    // 2. Status validation
    if (promo.status && promo.status !== "active") {
        throw new ApiError(status.BAD_REQUEST, `This coupon is currently ${promo.status}`);
    }

    const now = new Date();

    // 3. Validity period check
    if (promo.validForm && new Date(promo.validForm) > now) {
        const formattedStart = new Date(promo.validForm).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
        throw new ApiError(status.BAD_REQUEST, `This coupon is not active yet. Valid from ${formattedStart}`);
    }

    if (promo.validTo && new Date(promo.validTo) < now) {
        throw new ApiError(status.BAD_REQUEST, "This coupon has expired");
    }

    // 4. Minimum spend check
    const numericAmount = amount !== undefined && amount !== null && amount !== "" ? Number(amount) : null;
    const minspend = Number(promo.minspend) || 0;

    if (numericAmount !== null && !isNaN(numericAmount) && numericAmount > 0) {
        if (minspend > 0 && numericAmount < minspend) {
            throw new ApiError(
                status.BAD_REQUEST,
                `Minimum booking amount of ₦${minspend.toLocaleString()} is required to use this coupon`
            );
        }
    }

    // 5. Eligibility check
    if (promo.eligiblity === "new-users" && userId) {
        const bookingModel = require("../Booking/booking.model");
        const existingBookingsCount = await bookingModel.countDocuments({
            user: userId,
            paymentStatus: { $in: ["paid", "successful"] },
        });
        if (existingBookingsCount > 0) {
            throw new ApiError(status.BAD_REQUEST, "This coupon is only valid for new users on their first booking");
        }
    } else if (promo.eligiblity === "employees" && userId) {
        const userModel = require("../User/user.model");
        const currentUser = await userModel.findById(userId).select("role employer isEmployee");
        const isEmployee = currentUser && (currentUser.role === "employee" || currentUser.isEmployee || currentUser.employer);
        if (!isEmployee) {
            throw new ApiError(status.BAD_REQUEST, "This coupon is only valid for corporate employees");
        }
    }

    // 6. Creator Role & Partner Validation
    // Admin promos: valid for all partners
    // Partner promos: only valid for the specific partner who created it
    let partnerInfo = null;

    if (promo.createdBy === "partner") {
        if (!partnerId) {
            throw new ApiError(
                status.BAD_REQUEST,
                "This coupon is created by a specific partner. Please provide a partner to apply this coupon."
            );
        }

        const promoPartnerUserId = String(promo.user);
        const inputPartnerId = String(partnerId);

        let isMatch = false;

        // Check A: inputPartnerId matches promo.user directly
        if (inputPartnerId === promoPartnerUserId) {
            isMatch = true;
            partnerInfo = await partnerModel.findOne({ user: promo.user }).select("_id businessName user");
        } else if (mongoose.Types.ObjectId.isValid(inputPartnerId)) {
            // Check B: inputPartnerId is a Partner document _id
            const partnerDoc = await partnerModel.findById(inputPartnerId).select("_id businessName user");
            if (partnerDoc && String(partnerDoc.user) === promoPartnerUserId) {
                isMatch = true;
                partnerInfo = partnerDoc;
            } else {
                // Check C: inputPartnerId is a user ID in partners collection
                const partnerByUser = await partnerModel.findOne({ user: inputPartnerId }).select("_id businessName user");
                if (partnerByUser && String(partnerByUser.user) === promoPartnerUserId) {
                    isMatch = true;
                    partnerInfo = partnerByUser;
                }
            }
        }

        if (!isMatch) {
            const ownerPartner = await partnerModel.findOne({ user: promo.user }).select("businessName");
            const partnerName = ownerPartner?.businessName || "the issuing partner";
            throw new ApiError(
                status.BAD_REQUEST,
                `This coupon is only valid for bookings with ${partnerName}`
            );
        }
    } else if (promo.createdBy === "admin") {
        // Admin coupon is valid for all partners
        if (partnerId && mongoose.Types.ObjectId.isValid(String(partnerId))) {
            partnerInfo =
                (await partnerModel.findById(partnerId).select("_id businessName user")) ||
                (await partnerModel.findOne({ user: partnerId }).select("_id businessName user"));
        }
    }

    // 7. Calculate Discount Amount
    const promoDiscount = Number(promo.discount) || 0;
    let discountAmount = 0;

    const discountType = promo.discountType || (promoDiscount <= 100 && promo.discountType === "percentage" ? "percentage" : "fixed");

    if (discountType === "percentage" || discountType === "percent") {
        if (numericAmount !== null && numericAmount > 0) {
            discountAmount = (numericAmount * promoDiscount) / 100;
            if (promo.maxDiscount && discountAmount > Number(promo.maxDiscount)) {
                discountAmount = Number(promo.maxDiscount);
            }
        } else {
            discountAmount = promoDiscount;
        }
    } else {
        discountAmount = promoDiscount;
    }

    if (numericAmount !== null && numericAmount > 0) {
        discountAmount = Math.min(numericAmount, discountAmount);
    }

    discountAmount = Number(discountAmount.toFixed(2));
    const finalAmount =
        numericAmount !== null && numericAmount > 0
            ? Number(Math.max(0, numericAmount - discountAmount).toFixed(2))
            : null;

    return {
        isValid: true,
        code: promo.code,
        name: promo.name || promo.code,
        description: promo.description || "",
        discount: promo.discount,
        discountType,
        discountAmount,
        originalAmount: numericAmount,
        finalAmount,
        minspend: promo.minspend || 0,
        createdBy: promo.createdBy,
        partner: partnerInfo
            ? {
                  id: partnerInfo._id,
                  businessName: partnerInfo.businessName,
              }
            : null,
        promoId: promo._id,
    };
};

module.exports = {
    addPromoService,
    editPromoService,
    deletePromoService,
    getPartnerPromoService,
    getAdminPromoService,
    getCouponsByPartnerService,
    verifyCouponService,
};