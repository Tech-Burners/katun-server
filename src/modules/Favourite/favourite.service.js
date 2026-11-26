const { default: mongoose } = require("mongoose");
const favouriteModel = require("./favourite.model");
const userModel = require("../User/user.model");

const favouriteUnfavouriteService = async (data) => {
    const isExist = await favouriteModel.findOne({ user: data.user, service: data.service });
    if (isExist) {
        return await favouriteModel.findByIdAndDelete(isExist._id);
    }
    return await favouriteModel.create(data);
}



const myFavouriteService = async (userId, locationOptions = null) => {

  let coordinates = null;

  if (locationOptions?.lat != null && locationOptions?.lng != null && !isNaN(Number(locationOptions.lat)) && !isNaN(Number(locationOptions.lng))) {
    coordinates = [Number(locationOptions.lng), Number(locationOptions.lat)];
  } else {
    // ---------- LOGIN USER LOCATION ----------
    const loginUser = await userModel
      .findById(userId)
      .select("location");

    if (
      loginUser?.location?.coordinates &&
      loginUser.location.coordinates.length === 2
    ) {
      coordinates = loginUser.location.coordinates;
    }
  }

  const pipeline = [
    {
      $match: {
        user: new mongoose.Types.ObjectId(String(userId)),
      },
    },

    // ---------- SERVICE ----------
    {
      $lookup: {
        from: "services",
        localField: "service",
        foreignField: "_id",
        as: "serviceData",
      },
    },
    {
      $unwind: {
        path: "$serviceData",
        preserveNullAndEmptyArrays: false,
      },
    },

    // ---------- PROVIDER ----------
    {
      $lookup: {
        from: "users",
        localField: "serviceData.user",
        foreignField: "_id",
        as: "provider",
      },
    },
    {
      $unwind: {
        path: "$provider",
        preserveNullAndEmptyArrays: true,
      },
    },

    // ---------- PARTNER ----------
    {
      $lookup: {
        from: "partners",
        localField: "provider._id",
        foreignField: "user",
        as: "partner",
      },
    },
    {
      $unwind: {
        path: "$partner",
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  // ---------- SAFE DISTANCE ----------
  if (coordinates) {
    pipeline.push({
      $addFields: {
        distance: {
          $cond: [
            {
              $and: [
                { $isArray: "$provider.location.coordinates" },
                {
                  $eq: [
                    { $size: "$provider.location.coordinates" },
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
                              "$provider.location.coordinates",
                              0,
                            ],
                          },
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
                          {
                            $arrayElemAt: [
                              "$provider.location.coordinates",
                              1,
                            ],
                          },
                          coordinates[1],
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
    });
  }

  // ---------- RESPONSE ----------
  pipeline.push({
    $project: {
      _id: 0,

      serviceId: "$serviceData._id",
      name: "$serviceData.name",
      image: "$serviceData.image",
      servicefee: "$serviceData.servicefee",
      avgRating: "$serviceData.avgRating",
      ratingCount: "$serviceData.ratingCount",

      providerName: "$provider.fullName",

      isVerified: {
        $cond: [
          { $or: [{ $eq: ["$partner.isVerified", true] }, { $eq: ["$provider.isVerified", true] }] },
          true,
          false
        ]
      },

      isCertified: {
        $and: [
          { $gt: [{ $strLenCP: { $ifNull: ["$partner.certificate", ""] } }, 0] },
          { $gt: [{ $strLenCP: { $ifNull: ["$partner.identityProof", ""] } }, 0] },
          { $gt: [{ $strLenCP: { $ifNull: ["$partner.businessCertification", ""] } }, 0] },
          { $gt: [{ $strLenCP: { $ifNull: ["$partner.bankStatement", ""] } }, 0] }
        ]
      },

      distance: coordinates
        ? { $round: [{ $multiply: ["$distance", 111] }, 2] }
        : null,
    },
  });

  return await favouriteModel.aggregate(pipeline);
};


module.exports = {
    favouriteUnfavouriteService,
    myFavouriteService
}