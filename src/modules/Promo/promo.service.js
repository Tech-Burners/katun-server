const { default: mongoose } = require("mongoose");
const promoModel = require("./promo.model");
const partnerModel = require("../Partner/partner.model");
const serviceModel = require("../Service/service.model");
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

const verifyCouponService = async ({ code, serviceId, partnerId, amount, userId }) => {
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

    const now = new Date();

    // 3. Start Date validation (validForm)
    if (promo.validForm && new Date(promo.validForm) > now) {
        const formattedStart = new Date(promo.validForm).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
        return {
            isValid: false,
            discountAmount: 0,
            message: `This coupon is not active yet. Valid from ${formattedStart}`,
        };
    }

    // 4. Expiration Date validation (validTo)
    if (promo.validTo && new Date(promo.validTo) < now) {
        return {
            isValid: false,
            discountAmount: 0,
            message: "This coupon has expired",
        };
    }

    // 5. Usage Limit validation (usageLimit)
    const usageLimit = Number(promo.usageLimit) || 0;
    if (usageLimit > 0) {
        const bookingModel = require("../Booking/booking.model");
        const bookingsCount = await bookingModel.countDocuments({
            $or: [
                { coupon: promo.code },
                { promoCode: promo.code },
                { promo: promo._id },
            ],
        });
        const totalUsed = Math.max(Number(promo.usedCount) || 0, bookingsCount);
        if (totalUsed >= usageLimit) {
            return {
                isValid: false,
                discountAmount: 0,
                message: "This coupon has reached its maximum usage limit",
            };
        }
    }

    // 6. Service lookup (if serviceId is provided)
    let serviceDoc = null;
    if (serviceId) {
        if (mongoose.Types.ObjectId.isValid(String(serviceId))) {
            serviceDoc = await serviceModel.findById(serviceId).select("_id user name servicefee");
        }
        if (!serviceDoc) {
            return {
                isValid: false,
                discountAmount: 0,
                message: "Service not found",
            };
        }
    }

    // 7. Minimum spend check (minspend)
    const numericAmount = amount !== undefined && amount !== null && amount !== "" ? Number(amount) : null;
    const minspend = Number(promo.minspend) || 0;
    let amountToCheck = numericAmount;
    if (amountToCheck === null && serviceDoc && serviceDoc.servicefee !== undefined) {
        amountToCheck = Number(serviceDoc.servicefee);
    }

    if (minspend > 0 && amountToCheck !== null && !isNaN(amountToCheck) && amountToCheck > 0) {
        if (amountToCheck < minspend) {
            return {
                isValid: false,
                discountAmount: 0,
                message: `Minimum booking amount of ₦${minspend.toLocaleString()} is required to use this coupon`,
            };
        }
    }

    // 8. User Eligibility check (eligiblity)
    if (promo.eligiblity === "new-users") {
        if (!userId) {
            return {
                isValid: false,
                discountAmount: 0,
                message: "This coupon is only valid for new users. Please sign in to apply this coupon.",
            };
        }
        const bookingModel = require("../Booking/booking.model");
        const existingBookingsCount = await bookingModel.countDocuments({
            user: userId,
            $or: [
                { paymentStatus: { $in: ["paid", "successful"] } },
                { status: { $in: ["approved", "completed"] } },
            ],
        });
        if (existingBookingsCount > 0) {
            return {
                isValid: false,
                discountAmount: 0,
                message: "This coupon is only valid for new users on their first booking",
            };
        }
    } else if (promo.eligiblity === "employees") {
        if (!userId) {
            return {
                isValid: false,
                discountAmount: 0,
                message: "This coupon is only valid for corporate employees. Please sign in to apply this coupon.",
            };
        }
        const userModel = require("../User/user.model");
        const currentUser = await userModel.findById(userId).select("role employer isEmployee");
        const isEmployee = currentUser && (currentUser.role === "employee" || currentUser.isEmployee || currentUser.employer);
        if (!isEmployee) {
            return {
                isValid: false,
                discountAmount: 0,
                message: "This coupon is only valid for corporate employees",
            };
        }
    }

    // 9. Creator Role & Service/Partner Validation
    // - Admin coupons (createdBy: 'admin'): valid for all users across all services
    // - Partner coupons (createdBy: 'partner'): valid only for services belonging to that specific partner
    if (promo.createdBy === "partner") {
        const promoPartnerUserId = String(promo.user);
        let isMatch = false;
        let checkedContext = false;

        // Check A: service is provided -> check if the service belongs to this partner
        if (serviceDoc) {
            checkedContext = true;
            if (String(serviceDoc.user) === promoPartnerUserId) {
                isMatch = true;
            }
        }

        // Check B: partner is provided (and not already matched via service)
        if (!isMatch && partnerId) {
            checkedContext = true;
            const inputPartnerId = String(partnerId);

            if (inputPartnerId === promoPartnerUserId) {
                isMatch = true;
            } else if (mongoose.Types.ObjectId.isValid(inputPartnerId)) {
                const partnerDoc = await partnerModel.findById(inputPartnerId).select("_id businessName user");
                if (partnerDoc && String(partnerDoc.user) === promoPartnerUserId) {
                    isMatch = true;
                } else {
                    const partnerByUser = await partnerModel.findOne({ user: inputPartnerId }).select("_id businessName user");
                    if (partnerByUser && String(partnerByUser.user) === promoPartnerUserId) {
                        isMatch = true;
                    }
                }
            }
        }

        if (!checkedContext) {
            return {
                isValid: false,
                discountAmount: 0,
                message: "This coupon is only valid for a specific partner's services. Please provide the service or partner.",
            };
        }

        if (!isMatch) {
            return {
                isValid: false,
                discountAmount: 0,
                message: "This coupon is only valid for services provided by the issuing partner",
            };
        }
    }

    // 10. Discount Amount
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