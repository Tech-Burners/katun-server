const { default: mongoose } = require("mongoose");
const bookingModel = require("../Booking/booking.model");
const serviceModel = require("../Service/service.model");
const userModel = require("../User/user.model");
const promoModel = require("../Promo/promo.model");
const { sub } = require("date-fns/sub");

const pendingBookingService = async (user) => {

  return await bookingModel.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(String(user)),
        status: "approved",
        paymentStatus: "paid"
      }
    },

    {
      $sort: { createdAt: -1 }
    },

    {
      $limit: 10
    },

    {
      $lookup: {
        from: 'services',
        localField: 'service',
        foreignField: '_id',
        as: 'serviceData'
      }
    },

    {
      $unwind: {
        path: '$serviceData',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'subcategories',
        localField: 'serviceData.subCategory',
        foreignField: '_id',
        as: 'subCategoryData'
      }

    },
    {
      $unwind: {
        path: '$subCategoryData',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 0,
        bookingId: '$_id',
        status: 1,
        serviceName: '$serviceData.name',
        serviceId: '$serviceData._id',
        subCategoryName: '$subCategoryData.name',
        date: 1
      }
    }
  ]);
};


// const nearestService = async (longitude, latitude) => {

//   return await userModel.aggregate([
//     {
//       $geoNear: {
//         near: {
//           type: "Point",
//           coordinates: [longitude, latitude]
//         },
//         distanceField: "distance",
//         spherical: true,
//         distanceMultiplier: 0.001, // KM
//         maxDistance: 8000 // 8 KM radius
//       }
//     },

//     {
//       $match: {
//         role: "partner",
//         isDeleted: false
//       }
//     },

//     {
//       $lookup: {
//         from: "services",
//         localField: "_id",
//         foreignField: "user",
//         as: "service"
//       }
//     },

//     { $unwind:{ path: "$service", preserveNullAndEmptyArrays: true } },

//     {
//       $match: {
//         "service.isActive": true,
//         "service.isDeleted": false
//       }
//     },
//     {
//       $lookup: {
//         from: "subcategories",
//         localField: "service.subCategory",
//         foreignField: "_id",
//         as: "subCategory"
//       }
//     },
//     {
//       $unwind: {
//         path: "$subCategory",
//         preserveNullAndEmptyArrays: true
//       }
//     },
//     {
//       $addFields: {
//         score: {
//           $add: [

//             // distance penalty
//             { $multiply: ["$distance", 0.5] },

//             // high rating boost
//             { $multiply: ["$service.avgRating", -2] },

//             // popularity boost
//             { $multiply: ["$service.sell", -0.01] }
//           ]
//         }
//       }
//     },

//     {
//       $sort: { score: 1 }
//     },

//     {
//       $sample: { size: 2 }
//     },
//     {
//       $project: {
//         _id: "$service._id",
//         name: "$service.name",
//         image: "$service.image",
//         servicefee: "$service.servicefee",
//         avgRating: "$service.avgRating",
//         ratingCount: "$service.ratingCount",
//         sell: "$service.sell",
//         subCategoryName: "$subCategory.name",
//         isVerified: 1,
//         distance: { $round: ["$distance", 2] },
//       }
//     }
//   ]);
// };



const nearestService = async (longitude, latitude) => {
  console.log(longitude, latitude);
  const pipeline = [];

  // =========================
  // LOGGED-IN USER WITH LOCATION
  // =========================
  if (longitude != null && latitude != null) {
    pipeline.push({
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [
            Number(longitude),
            Number(latitude)
          ]
        },
        distanceField: "distance",
        spherical: true,
        distanceMultiplier: 0.001,
        maxDistance: 8000 // 8 KM
      }
    });
  }

  // =========================
  // COMMON FILTER
  // =========================
  pipeline.push(
    {
      $match: {
        role: "partner",
        isDeleted: false
      }
    },

    {
      $lookup: {
        from: "services",
        localField: "_id",
        foreignField: "user",
        as: "service"
      }
    },

    {
      $unwind: {
        path: "$service",
        preserveNullAndEmptyArrays: false
      }
    },

    {
      $match: {
        "service.isActive": true,
        "service.isDeleted": false
      }
    },

    {
      $lookup: {
        from: "subcategories",
        localField: "service.subCategory",
        foreignField: "_id",
        as: "subCategory"
      }
    },

    {
      $unwind: {
        path: "$subCategory",
        preserveNullAndEmptyArrays: true
      }
    }
  );

  // =========================
  // ONLY LOGGED-IN USER
  // =========================
  if (longitude != null && latitude != null) {
    pipeline.push({
      $addFields: {
        score: {
          $add: [
            // Distance penalty
            {
              $multiply: ["$distance", 0.5]
            },

            // Rating boost
            {
              $multiply: [
                "$service.avgRating",
                -2
              ]
            },

            // Popularity boost
            {
              $multiply: [
                "$service.sell",
                -0.01
              ]
            }
          ]
        }
      }
    });

    pipeline.push({
      $sort: {
        score: 1
      }
    });
  } else {
    // =========================
    // GUEST USER
    // =========================
    // Show all active services
    pipeline.push({
      $sort: {
        "service.avgRating": -1,
        "service.sell": -1
      }
    });
  }

  // =========================
  // FINAL RESPONSE
  // =========================
  pipeline.push({
    $project: {
      _id: "$service._id",
      name: "$service.name",
      image: "$service.image",
      servicefee: "$service.servicefee",
      avgRating: "$service.avgRating",
      ratingCount: "$service.ratingCount",
      sell: "$service.sell",
      subCategoryName: "$subCategory.name",
      isVerified: 1,

      distance: {
        $cond: [
          {
            $ne: [
              { $type: "$distance" },
              "missing"
            ]
          },
          {
            $round: ["$distance", 2]
          },
          null
        ]
      }
    }
  });

  return await userModel.aggregate(pipeline);
};




const allNearestService = async (longitude, latitude, options) => {

  const { page = 1, limit = 10, search } = options;
  const skip = (page - 1) * limit;

  const serviceMatch = {
    "service.isActive": true,
    "service.isDeleted": false,
  };

  if (search && search.trim() !== "") {
    serviceMatch["service.name"] = {
      $regex: search,
      $options: "i",
    };
  }

  const pipeline = [

    // ---------- GEO ----------
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        distanceField: "distance",
        spherical: true,
        distanceMultiplier: 0.001,
        maxDistance: 8000,
      },
    },

    // ---------- PARTNER ----------
    {
      $match: {
        role: "partner",
        isDeleted: false,
      },
    },

    // ---------- SERVICE ----------
    {
      $lookup: {
        from: "services",
        localField: "_id",
        foreignField: "user",
        as: "service",
      },
    },

    {
      $unwind: {
        path: "$service",
        preserveNullAndEmptyArrays: false,
      },
    },

    {
      $match: serviceMatch,
    },

    // ---------- PROVIDER ----------
    {
      $lookup: {
        from: "users",
        localField: "service.user",
        foreignField: "_id",
        as: "providerInfo",
      },
    },
    {
      $unwind: {
        path: "$providerInfo",
        preserveNullAndEmptyArrays: true,
      },
    },

    // ---------- SUBCATEGORY ----------
    {
      $lookup: {
        from: "subcategories",
        localField: "service.subCategory",
        foreignField: "_id",
        as: "subCategory",
      },
    },
    {
      $unwind: {
        path: "$subCategory",
        preserveNullAndEmptyArrays: true,
      },
    },

    // ---------- SMART SCORE ----------
    {
      $addFields: {
        score: {
          $add: [
            { $multiply: ["$distance", 0.5] },
            { $multiply: ["$service.avgRating", -2] },
            { $multiply: ["$service.sell", -0.01] },
          ],
        },
      },
    },

    { $sort: { score: 1 } },
    { $skip: skip },
    { $limit: limit },

    // ---------- RESPONSE ----------
    {
      $project: {
        _id: "$service._id",
        name: "$service.name",
        image: "$service.image",
        servicefee: "$service.servicefee",
        avgRating: "$service.avgRating",
        ratingCount: "$service.ratingCount",
        sell: "$service.sell",
        subCategoryName: "$subCategory.name",
        providerName: "$providerInfo.fullName",
          providerId: "$providerInfo._id",
        distance: { $round: ["$distance", 2] },
      },
    },
  ];

  const [result, count] = await Promise.all([
    userModel.aggregate(pipeline),

    userModel.countDocuments({
      role: "partner",
      isDeleted: false,
    }),
  ]);

  return {
    result,
    pagination: {
      totalResults: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      limit,
    },
  };
};

const promoService = async () => {
  return await promoModel.aggregate([
    {
      $match: {
        status  : "active"
      }
    },
    {
      $project: {
        _id: 0,
        code : 1,
        name: 1,
        description: 1,
        discount: 1,
        usageLimit: 1,
        validForm: 1,
        validTo: 1,
        image: 1
      }
    }
  ])
}

module.exports = { pendingBookingService, nearestService, promoService, allNearestService}