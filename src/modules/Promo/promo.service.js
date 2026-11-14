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

const verifyCouponService = async ({ code, partnerId, amount }) => {
    if (!code || typeof code !== "string" || code.trim() === "") {
        return {
            isValid: false,
            discountAmount: 0,
            message: "Coupon code is required",
        };
    }

    const trimmedCode = code.trim();

    // 1. Case-insensitive search for promo by code
    const promo = await promoModel.findOne({
        code: { $regex: new RegExp(`^${trimmedCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });

    if (!promo) {
        return {
            isValid: false,
            discountAmount: 0,
            message: "Invalid coupon code",
        };
    }

    // 2. Status validation (Active / Inactive)
    if (promo.status && promo.status !== "active") {
        return {
            isValid: false,
            discountAmount: 0,
            message: `This coupon is currently ${promo.status}`,
        };
    }

    // 3. Expiration Date check (validTo)
    if (promo.validTo && new Date(promo.validTo) < new Date()) {
        return {
            isValid: false,
            discountAmount: 0,
            message: "This coupon has expired",
        };
    }

    // 4. Minimum spend check (if amount is passed)
    const numericAmount = amount !== undefined && amount !== null && amount !== "" ? Number(amount) : null;
    const minspend = Number(promo.minspend) || 0;

    if (numericAmount !== null && !isNaN(numericAmount) && numericAmount > 0) {
        if (minspend > 0 && numericAmount < minspend) {
            return {
                isValid: false,
                discountAmount: 0,
                message: `Minimum booking amount of ₦${minspend.toLocaleString()} is required to use this coupon`,
            };
        }
    }

    // 5. Creator Role & Partner Validation
    // Admin promos: valid for all partners
    // Partner promos: only valid for the specific partner who created it
    if (promo.createdBy === "partner") {
        if (!partnerId) {
            return {
                isValid: false,
                discountAmount: 0,
                message: "This coupon is only valid for a specific partner. Please provide the partner ID.",
            };
        }

        const promoPartnerUserId = String(promo.user);
        const inputPartnerId = String(partnerId);

        let isMatch = false;

        // Check A: inputPartnerId matches promo.user directly
        if (inputPartnerId === promoPartnerUserId) {
            isMatch = true;
        } else if (mongoose.Types.ObjectId.isValid(inputPartnerId)) {
            // Check B: inputPartnerId is a Partner document _id
            const partnerDoc = await partnerModel.findById(inputPartnerId).select("_id businessName user");
            if (partnerDoc && String(partnerDoc.user) === promoPartnerUserId) {
                isMatch = true;
            } else {
                // Check C: inputPartnerId is a user ID in partners collection
                const partnerByUser = await partnerModel.findOne({ user: inputPartnerId }).select("_id businessName user");
                if (partnerByUser && String(partnerByUser.user) === promoPartnerUserId) {
                    isMatch = true;
                }
            }
        }

        if (!isMatch) {
            return {
                isValid: false,
                discountAmount: 0,
                message: "This coupon is not valid for this partner",
            };
        }
    }

    // 6. Discount Amount
    const discountAmount = Number(promo.discount || 0);

    return {
        isValid: true,
        discountAmount,
        message: "Coupon is valid",
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