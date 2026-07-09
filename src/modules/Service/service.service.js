const { default: mongoose } = require("mongoose");
const serviceModel = require("./service.model");
const { WhatsApp } = require("twilio/lib/twiml/VoiceResponse");
const { sub, add } = require("date-fns");
const { default: status } = require("http-status");
const userModel = require("../User/user.model");

const addServiceService = async (data) => {
  return await serviceModel.create(data);
}

const editServiceService = async (id, data) => {
  return await serviceModel.findByIdAndUpdate(id, data, { new: true });
}

const deleteServiceService = async (id) => {
  return await serviceModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
}

const disableServiceService = async (id) => {
  return await serviceModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
}

const activeEmployerService = async (id) => {
  return await serviceModel.findByIdAndUpdate(id, { isActive: true }, { new: true });
}



const getAllServiceService = async (options) => {

  const {
    page = 1,
    limit = 10,
    search,
    categoryId,
    subCategoryId,
    status
  } = options;

  const skip = (page - 1) * limit;

  /* ---------------- BASE MATCH ---------------- */

  const matchStage = {
    isDeleted: false
  };

  if (categoryId) {
    matchStage.category =
      new mongoose.Types.ObjectId(String(categoryId));
  }

  if (subCategoryId) {
    matchStage.subCategory =
      new mongoose.Types.ObjectId(String(subCategoryId));
  }

  if (status === "active") matchStage.isActive = true;
  if (status === "inactive") matchStage.isActive = false;

  /* ---------------- PIPELINE ---------------- */

  const pipeline = [

    { $match: matchStage },

    /* provider */
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "providerData"
      }
    },
    { $unwind: { path: "$providerData", preserveNullAndEmptyArrays: true } },

    /* category */
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "category"
      }
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

    /* subcategory */
    {
      $lookup: {
        from: "subcategories",
        localField: "subCategory",
        foreignField: "_id",
        as: "subcategory"
      }
    },
    { $unwind: { path: "$subcategory", preserveNullAndEmptyArrays: true } },

    /* SEARCH */
    ...(search
      ? [{
        $match: {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { "providerData.fullName": { $regex: search, $options: "i" } },
            { "category.name": { $regex: search, $options: "i" } },
            { "subcategory.name": { $regex: search, $options: "i" } }
          ]
        }
      }]
      : []),

    /* BOOKING COUNT */
    {
      $lookup: {
        from: "bookings",
        let: { serviceId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$service", "$$serviceId"] },
                  { $in: ["$status", ["approved", "completed"]] }
                ]
              }
            }
          },
          { $count: "total" }
        ],
        as: "bookingData"
      }
    },

    {
      $addFields: {
        totalBooking: {
          $ifNull: [
            { $arrayElemAt: ["$bookingData.total", 0] },
            0
          ]
        }
      }
    },

    /* ---------- FACET FOR PERFECT PAGINATION ---------- */

    {
      $facet: {

        data: [
          {
            $project: {
              serviceId: "$_id",
              serviceName: "$name",
              categoryName: "$category.name",
              categoryId: "$category._id",
              subCategoryName: "$subcategory.name",
              subCategoryId: "$subcategory._id",
              providerName: "$providerData.fullName",
              description: 1,
              duration: 1,
              servicefee: 1,
              included: 1,
              image: 1,
              addons: 1,
              pass: 1,
              user: 1,
              isActive: 1,
              createdAt: 1,
              totalBooking: 1
            }
          },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit }
        ],

        totalCount: [
          { $count: "count" }
        ]
      }
    }
  ];

  const result = await serviceModel.aggregate(pipeline);

  const data = result[0].data;
  const totalResults = result[0].totalCount[0]?.count || 0;

  return {
    result: data,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit
    }
  };
};



const getPartnerAllServiceService = async (user, options) => {

  const {
    page = 1,
    limit = 10,
    search,
    categoryId,
    subCategoryId,
    status
  } = options;

  const skip = (page - 1) * limit;

  /* ---------------- BASE MATCH ---------------- */

  const matchStage = {
    isDeleted: false,
    user: new mongoose.Types.ObjectId(String(user))
  };

  if (categoryId) {
    matchStage.category =
      new mongoose.Types.ObjectId(categoryId);
  }

  if (subCategoryId) {
    matchStage.subCategory =
      new mongoose.Types.ObjectId(subCategoryId);
  }

  if (status === "active") matchStage.isActive = true;
  if (status === "inactive") matchStage.isActive = false;

  /* ---------------- PIPELINE ---------------- */

  const pipeline = [

    { $match: matchStage },

    /* PROVIDER */
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "providerData"
      }
    },
    { $unwind: { path: "$providerData", preserveNullAndEmptyArrays: true } },

    /* CATEGORY */
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "category"
      }
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

    /* SUBCATEGORY */
    {
      $lookup: {
        from: "subcategories",
        localField: "subCategory",
        foreignField: "_id",
        as: "subcategory"
      }
    },
    { $unwind: { path: "$subcategory", preserveNullAndEmptyArrays: true } },

    /* ---------------- SEARCH ---------------- */

    ...(search
      ? [{
        $match: {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { "providerData.fullName": { $regex: search, $options: "i" } },
            { "category.name": { $regex: search, $options: "i" } },
            { "subcategory.name": { $regex: search, $options: "i" } }
          ]
        }
      }]
      : []),

    /* ---------------- BOOKING COUNT ---------------- */

    {
      $lookup: {
        from: "bookings",
        let: { serviceId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$service", "$$serviceId"] },
                  { $in: ["$status", ["approved", "completed"]] }
                ]
              }
            }
          },
          { $count: "total" }
        ],
        as: "bookingData"
      }
    },

    {
      $addFields: {
        totalBooking: {
          $ifNull: [
            { $arrayElemAt: ["$bookingData.total", 0] },
            0
          ]
        }
      }
    },

    /* ---------------- PERFECT PAGINATION ---------------- */

    {
      $facet: {

        data: [
          {
            $project: {
              serviceId: "$_id",
              serviceName: "$name",
              categoryName: "$category.name",
              categoryId: "$category._id",
              subCategoryName: "$subcategory.name",
              subCategoryId: "$subcategory._id",
              providerName: "$providerData.fullName",
              description: 1,
              duration: 1,
              servicefee: 1,
              included: 1,
              image: 1,
              addons: 1,
              pass: 1,
              user: 1,
              isActive: 1,
              createdAt: 1,
              totalBooking: 1
            }
          },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit }
        ],

        totalCount: [
          { $count: "count" }
        ]
      }
    }
  ];

  const result = await serviceModel.aggregate(pipeline);

  const data = result[0].data;
  const totalResults = result[0].totalCount[0]?.count || 0;

  return {
    result: data,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit
    }
  };
};


const aServiceDetailsService = async (id, userId = null) => {

  const userObjectId = userId
    ? new mongoose.Types.ObjectId(userId)
    : null;

  return await serviceModel.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id)
      }
    },

    // provider
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "provider"
      }
    },
    { $unwind: { path: "$provider", preserveNullAndEmptyArrays: true } },

    // availability
    {
      $lookup: {
        from: "availabilities",
        localField: "_id",
        foreignField: "service",
        as: "availability"
      }
    },
    {
      $unwind: {
        path: "$availability",
        preserveNullAndEmptyArrays: true
      }
    },

    // category
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "category"
      }
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

    // commission
    {
      $lookup: {
        from: "commissions",
        localField: "category._id",
        foreignField: "category",
        as: "commission"
      }
    },
    { $unwind: { path: "$commission", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "favourites",
        let: {
          serviceId: "$_id",
          userId: userObjectId
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$service", "$$serviceId"] },
                  { $eq: ["$user", "$$userId"] }
                ]
              }
            }
          }
        ],
        as: "fav"
      }
    },

    {
      $addFields: {
        isFavourite: {
          $gt: [{ $size: "$fav" }, 0]
        }
      }
    },

    {
      $addFields: {
        commissionAmount: {
          $multiply: [
            "$servicefee",
            { $divide: [{ $ifNull: ["$commission.commission", 0] }, 100] }
          ]
        }
      }
    },
    {
      $addFields: {
        isCashAllowed: {
          $gte: ["$provider.digitalWallet", "$commissionAmount"]
        }
      }
    },
    {
      $project: {
        name: 1,
        description: 1,
        duration: 1,
        servicefee: 1,
        included: 1,
        image: 1,
        addons: 1,
        pass: 1,
        price: 1,

        providerName: "$provider.fullName",
        providerImage: "$provider.image",
        providerId: "$provider._id",
        number: "$provider.number",
        countryCode: "$provider.countryCode",
        location: "$provider.location",
        isCashAllowed: 1,
        address: "$provider.address",

        availability: "$availability.slot",
        categoryName: "$category.name",
        categoryId: "$category._id",
        subCategory: 1,

        avgRating: 1,
        ratingCount: 1,

        isFavourite: 1
      }
    }
  ]);
};



const checkServiceAvailabilityService = async (userId) => {
const result = await serviceModel.aggregate([
  {
    $match: {
      user: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
      isActive: true,
    },
  },

  {
    $lookup: {
      from: "commissions",
      localField: "category",
      foreignField: "category",
      as: "commission",
    },
  },

  {
    $unwind: {
      path: "$commission",
      preserveNullAndEmptyArrays: true,
    },
  },

  {
    $addFields: {
      servicefeeNum: { $toDouble: "$servicefee" },

      commissionRate: {
        $ifNull: ["$commission.commission", 0],
      },

      commissionAmount: {
        $multiply: [
          { $toDouble: "$servicefee" },
          {
            $divide: [
              { $ifNull: ["$commission.commission", 0] },
              100,
            ],
          },
        ],
      },
    },
  },

  {
    $group: {
      _id: "$user",
      maxCommissionAmount: { $max: "$commissionAmount" },
    },
  },

  {
    $lookup: {
      from: "users",
      localField: "_id",
      foreignField: "_id",
      as: "user",
    },
  },

  { $unwind: "$user" },

  {
    $addFields: {
      walletBalance: {
        $ifNull: ["$user.digitalWallet", 0],
      },
    },
  },

  {
    $project: {
      _id: 0,

      walletBalance: { $round: ["$walletBalance", 3] },

      maxCommissionAmount: {
        $round: ["$maxCommissionAmount", 3],
      },

      hasAvailableBalance: {
        $gte: [
          { $ifNull: ["$user.digitalWallet", 0] },
          { $ifNull: ["$maxCommissionAmount", 0] },
        ],
      },
    },
  },
]);

  return (
    result[0] || {
      walletBalance: 0,
      maxCommissionAmount: 0,
      hasAvailableBalance: false,
    }
  );
};



// const allServiceService = async (options) => {
//   console.log("options in service service:", options)
//   const {
//     page = 1,
//     limit = 10,
//     categoryId,
//     subCategoryId,
//     rating,
//     search,
//     userId,
//     lat,
//     lng,
//   } = options;

//   const skip = (page - 1) * limit;

//   let coordinates = null;

//   // ---------- LOCATION ----------
//   if (lat && lng) {
//     coordinates = [Number(lng), Number(lat)];
//   }

//   if (!coordinates && userId) {
//     const loginUser = await userModel
//       .findById(userId)
//       .select("location");

//     if (loginUser?.location?.coordinates?.length === 2) {
//       coordinates = loginUser.location.coordinates;
//     }
//   }

//   const pipeline = [];

//   // ---------- ONLY ACTIVE SERVICES ----------
//   const matchStage = {
//     isDeleted: false,
//     isActive: true,
//   };

//   if (categoryId)
//     matchStage.category = new mongoose.Types.ObjectId(categoryId);

//   if (subCategoryId)
//     matchStage.subCategory = new mongoose.Types.ObjectId(subCategoryId);

//   if (rating)
//     matchStage.avgRating = { $gte: Number(rating) };

//   if (search)
//     matchStage.name = { $regex: search, $options: "i" };

//   pipeline.push({ $match: matchStage });

//   // ---------- USER LOOKUP ----------
//   pipeline.push(
//     {
//       $lookup: {
//         from: "users",
//         localField: "user",
//         foreignField: "_id",
//         as: "user",
//       },
//     },
//     { $unwind: "$user" }
//   );

//   // ---------- GEO DISTANCE ----------
//   if (coordinates) {
//     pipeline.push({
//       $addFields: {
//         distance: {
//           $divide: [
//             {
//               $sqrt: {
//                 $add: [
//                   {
//                     $pow: [
//                       {
//                         $subtract: [
//                           { $arrayElemAt: ["$user.location.coordinates", 0] },
//                           coordinates[0],
//                         ],
//                       },
//                       2,
//                     ],
//                   },
//                   {
//                     $pow: [
//                       {
//                         $subtract: [
//                           { $arrayElemAt: ["$user.location.coordinates", 1] },
//                           coordinates[1],
//                         ],
//                       },
//                       2,
//                     ],
//                   },
//                 ],
//               },
//             },
//             1,
//           ],
//         },
//       },
//     });
//   }

//   // ---------- PARTNER LOOKUP ----------
//   pipeline.push(
//     {
//       $lookup: {
//         from: "partners",
//         localField: "user._id",
//         foreignField: "user",
//         as: "partner",
//       },
//     },
//     {
//       $unwind: {
//         path: "$partner",
//         preserveNullAndEmptyArrays: true,
//       },
//     }
//   );

//   // ---------- CATEGORY ----------
//   pipeline.push(
//     {
//       $lookup: {
//         from: "categories",
//         localField: "category",
//         foreignField: "_id",
//         as: "category",
//       },
//     },
//     { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } }
//   );

//   // ---------- SUBCATEGORY ----------
//   pipeline.push(
//     {
//       $lookup: {
//         from: "subcategories",
//         localField: "subCategory",
//         foreignField: "_id",
//         as: "subcategory",
//       },
//     },
//     { $unwind: { path: "$subcategory", preserveNullAndEmptyArrays: true } }
//   );

//   // ---------- RESPONSE ----------
//   pipeline.push({
//     $project: {
//       _id: 1,
//       name: 1,
//       description: 1,
//       image: 1,
//       servicefee: 1,
//       avgRating: 1,
//       ratingCount: 1,

//       category: "$category.name",
//       subCategory: "$subcategory.name",
//       partnerName: "$partner.businessName",
//       partnerId: "$partner.user",

//       isCertified: {
//         $ifNull: ["$partner.isCertified", false],
//       },
//       isVerified: {
//         $ifNull: ["$partner.isVerified", false],
//       },

//       distance: coordinates
//         ? { $round: ["$distance", 2] }
//         : null,
//     },
//   });

//   // ---------- PAGINATION ----------
//   pipeline.push({
//     $facet: {
//       result: [{ $skip: skip }, { $limit: Number(limit) }],
//       totalCount: [{ $count: "count" }],
//     },
//   });

//   const result = await serviceModel.aggregate(pipeline);

//   const services = result[0]?.result || [];
//   const totalResults = result[0]?.totalCount[0]?.count || 0;

//   return {
//     result: services,
//     pagination: {
//       totalResults,
//       totalPages: Math.ceil(totalResults / limit),
//       currentPage: Number(page),
//       limit: Number(limit),
//     },
//   };
// };

const allServiceService = async (options) => {
  const {
    page = 1,
    limit = 10,
    categoryId,
    subCategoryId,
    rating,
    search,
    userId,
    lat,
    lng,
  } = options;
  const skip = (page - 1) * limit;
  let coordinates = null;
  let useLocationFilter = false;
  console.log("📌 Input Options:", { userId, lat, lng });

  // ---------- LOCATION COORDINATES ----------
  // Only use explicit lat/lng from query (for "near me" behavior)
  // Do NOT auto-fetch from logged-in user to prevent inconsistent result counts
  if (lat && lng) {
    coordinates = [Number(lng), Number(lat)];
    useLocationFilter = true;
    console.log("📍 Using explicit lat/lng coordinates");
  }
  // Removed auto user location fetch to fix inconsistency between auth/no-auth

  console.log("📍 Coordinates:", coordinates ? "YES" : "NO");

  const pipeline = [];

  // ---------- INITIAL MATCH ----------
  const matchStage = { isDeleted: false, isActive: true };
  if (categoryId) matchStage.category = new mongoose.Types.ObjectId(categoryId);
  if (subCategoryId) matchStage.subCategory = new mongoose.Types.ObjectId(subCategoryId);
  if (rating) matchStage.avgRating = { $gte: Number(rating) };
  if (search) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }
  pipeline.push({ $match: matchStage });

  // ---------- USER LOOKUP ----------
  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } }
  );

  // ---------- LOCATION FILTER (Only if explicit coordinates exist) ----------
  let locationFilterApplied = false;
  if (coordinates) {
    const radiusKm = 50;
    const radiusDegrees = radiusKm / 111;
    pipeline.push({
      $addFields: {
        distance: {
          $sqrt: {
            $add: [
              { $pow: [{ $subtract: [{ $arrayElemAt: ["$user.location.coordinates", 0] }, coordinates[0]] }, 2] },
              { $pow: [{ $subtract: [{ $arrayElemAt: ["$user.location.coordinates", 1] }, coordinates[1]] }, 2] },
            ],
          },
        },
      },
    });
    pipeline.push({
      $match: {
        distance: { $lte: radiusDegrees },
        "user.location.coordinates": { $exists: true, $size: 2 },
      },
    });
    pipeline.push({ $sort: { distance: 1 } });
    locationFilterApplied = true;
    console.log(`📍 Location filter applied (${radiusKm}km)`);
  }

  // ---------- AVAILABILITY CHECK ----------
  pipeline.push(
    {
      $lookup: {
        from: "availabilities",
        let: { serviceId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$service", "$$serviceId"] } } },
          { $match: { "slot.0": { $exists: true } } }
        ],
        as: "availability",
      },
    },
    {
      $match: { $expr: { $gt: [{ $size: "$availability" }, 0] } }
    }
  );

  // ---------- PARTNER + CATEGORY + SUBCATEGORY ----------
  pipeline.push(
    { $lookup: { from: "partners", localField: "user._id", foreignField: "user", as: "partner" } },
    { $unwind: { path: "$partner", preserveNullAndEmptyArrays: true } }
  );
  pipeline.push(
    { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "category" } },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } }
  );
  pipeline.push(
    { $lookup: { from: "subcategories", localField: "subCategory", foreignField: "_id", as: "subcategory" } },
    { $unwind: { path: "$subcategory", preserveNullAndEmptyArrays: true } }
  );

  // ---------- PROJECTION ----------
  pipeline.push({
    $project: {
      _id: 1, name: 1, description: 1, image: 1, servicefee: 1,
      avgRating: 1, ratingCount: 1,
      category: "$category.name",
      subCategory: "$subcategory.name",
      partnerName: "$partner.businessName",
      partnerId: "$partner.user",
      isCertified: { $ifNull: ["$partner.isCertified", false] },
      isVerified: { $ifNull: ["$partner.isVerified", false] },
      distance: coordinates ? { $round: [{ $multiply: ["$distance", 111] }, 2] } : null,
    },
  });

  // ---------- PAGINATION ----------
  pipeline.push({
    $facet: {
      result: [{ $skip: skip }, { $limit: Number(limit) }],
      totalCount: [{ $count: "count" }],
    },
  });

  let result = await serviceModel.aggregate(pipeline);
  let services = result[0]?.result || [];
  let totalResults = result[0]?.totalCount[0]?.count || 0;

  // 🔥 SMART FALLBACK: If no results with location filter → try without location
  if (locationFilterApplied && totalResults === 0) {
    console.log("⚠️ No services found nearby. Fetching all services as fallback...");
    // Re-run pipeline without location filter stages
    const fallbackPipeline = pipeline.filter(stage => 
      !stage.$addFields &&
      !(stage.$sort && stage.$sort.distance) &&
      !(stage.$match && stage.$match.distance)
    );
    const fallbackResult = await serviceModel.aggregate(fallbackPipeline);
    services = fallbackResult[0]?.result || [];
    totalResults = fallbackResult[0]?.totalCount[0]?.count || 0;
    console.log(`📈 Fallback returned ${totalResults} services`);
  }

  console.log(`📊 Final Results: ${services.length} / ${totalResults}`);

  return {
    result: services,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: Number(page),
      limit: Number(limit),
    },
    meta: locationFilterApplied && services.length === 0 && totalResults > 0
      ? { message: "No services found nearby. Showing all available services." }
      : undefined
  };
};

const popularService = async (userId, options) => {
  const { page = 1, limit = 10, lat, lng, search } = options;

  const skip = (page - 1) * limit;

  let coordinates = null;

  // ---------- LOCATION ----------
  if (lat && lng) {
    coordinates = [Number(lng), Number(lat)];
  }

  if (!coordinates && userId) {
    const loginUser = await userModel
      .findById(userId)
      .select("location");

    if (loginUser?.location?.coordinates?.length === 2) {
      coordinates = loginUser.location.coordinates;
    }
  }

  const pipeline = [];


  const matchStage = {
    isDeleted: false,
    isActive: true,
  };

  if (search && search.trim() !== "") {
    matchStage.name = {
      $regex: search,
      $options: "i", // case insensitive
    };
  }

  pipeline.push({ $match: matchStage });

  // ---------- AVAILABILITY CHECK (only services with at least one slot) ----------
  pipeline.push(
    {
      $lookup: {
        from: "availabilities",
        let: { serviceId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$service", "$$serviceId"] }
            }
          },
          {
            $match: {
              "slot.0": { $exists: true }
            }
          }
        ],
        as: "availability"
      }
    },
    {
      $match: {
        $expr: { $gt: [{ $size: "$availability" }, 0] }
      }
    }
  );

  // ---------- USER LOOKUP ----------
  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" }
  );

  // ---------- DISTANCE ----------
  if (coordinates) {
    pipeline.push({
      $addFields: {
        distance: {
          $sqrt: {
            $add: [
              {
                $pow: [
                  {
                    $subtract: [
                      { $arrayElemAt: ["$user.location.coordinates", 0] },
                      coordinates[0],
                    ],
                  },
                  2,
                ],
              },
              {
                $pow: [
                  {
                    $subtract: [
                      { $arrayElemAt: ["$user.location.coordinates", 1] },
                      coordinates[1],
                    ],
                  },
                  2,
                ],
              },
            ],
          },
        },
      },
    });
  }

  // ---------- PARTNER LOOKUP ----------
  pipeline.push(
    {
      $lookup: {
        from: "partners",
        localField: "user._id",
        foreignField: "user",
        as: "partner",
      },
    },
    {
      $unwind: {
        path: "$partner",
        preserveNullAndEmptyArrays: true,
      },
    }
  );

  // ---------- POPULAR SORT ----------
  pipeline.push({
    $sort: {
      sell: -1,       // most booked
      avgRating: -1,  // high rating
    },
  });

  // ---------- RESPONSE ----------
  pipeline.push({
    $project: {
      _id: 1,
      name: 1,
      image: 1,
      servicefee: 1,
      avgRating: 1,
      ratingCount: 1,
      sell: 1,

      partnerName: "$partner.businessName",
      partnerId: "$partner.user",
      isVerified: {
        $ifNull: ["$partner.isVerified", false],
      },
      isCertified: {
        $ifNull: ["$partner.isCertified", false],
      },

      distance: coordinates
        ? { $round: ["$distance", 2] }
        : null,
    },
  });

  // ---------- PAGINATION ----------
  pipeline.push({
    $facet: {
      result: [{ $skip: skip }, { $limit: Number(limit) }],
      totalCount: [{ $count: "count" }],
    },
  });

  const result = await serviceModel.aggregate(pipeline);

  const services = result[0]?.result || [];
  const totalResults = result[0]?.totalCount[0]?.count || 0;

  return {
    result: services,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: Number(page),
      limit: Number(limit),
    },
  };
};


module.exports = {
  addServiceService, editServiceService,
  getPartnerAllServiceService,
  deleteServiceService, activeEmployerService,
  getAllServiceService, aServiceDetailsService, disableServiceService,
  popularService,
  allServiceService,
  checkServiceAvailabilityService
}