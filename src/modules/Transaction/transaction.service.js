const { default: mongoose } = require("mongoose");
const transactionModel = require("./transaction.model");
const { options } = require("./transaction.route");
const userModel = require("../User/user.model");
const ApiError = require("../../helpers/ApiError");
const { getOrCreateCycle } = require("../Payout/payout.service");
const payoutCycleModel = require("../Payout/payoutCycle.model");





const getAllTransactions = async (option = {}) => {

  let {
    page = 1,
    limit = 10,
    month,
    year,
    payment_method,
    search
  } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;


  const now = new Date();

  month = Number(month);
  year = Number(year);

  if (!month || !year || isNaN(month) || isNaN(year)) {
    const lastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    month = lastMonth.getMonth() + 1;
    year = lastMonth.getFullYear();
  }


  const matchStage = {
    $match: {
      $expr: {
        $and: [
          { $eq: [{ $month: "$createdAt" }, month] },
          { $eq: [{ $year: "$createdAt" }, year] }
        ]
      }
    }
  };

  if (payment_method) {
    matchStage.$match.payment_method = payment_method;
  }


  const pipeline = [

    matchStage,

    { $sort: { createdAt: -1 } },

    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "userInfo"
      }
    },
    { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "users",
        localField: "partner",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    { $unwind: { path: "$partnerInfo", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "services",
        localField: "service",
        foreignField: "_id",
        as: "serviceInfo"
      }
    },
    { $unwind: { path: "$serviceInfo", preserveNullAndEmptyArrays: true } },


    ...(search
      ? [{
        $match: {
          $or: [
            {
              "partnerInfo.fullName": {
                $regex: search,
                $options: "i"
              }
            },
            {
              "userInfo.fullName": {
                $regex: search,
                $options: "i"
              }
            }
          ]
        }
      }]
      : []),

    { $skip: skip },
    { $limit: limit },

    {
      $project: {
        _id: 0,
        amount: "$net_amount",
        status: 1,
        booking: 1,
        payment_method: 1,
        createdAt: 1,
        description: 1,
        partnerName: "$partnerInfo.fullName",
        userName: "$userInfo.fullName",
        serviceName: "$serviceInfo.name"
      }
    }
  ];


  const countPipeline = [

    matchStage,

    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "userInfo"
      }
    },
    { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "users",
        localField: "partner",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    { $unwind: { path: "$partnerInfo", preserveNullAndEmptyArrays: true } },

    ...(search
      ? [{
        $match: {
          $or: [
            { "partnerInfo.fullName": { $regex: search, $options: "i" } },
            { "userInfo.fullName": { $regex: search, $options: "i" } }
          ]
        }
      }]
      : []),

    { $count: "total" }
  ];

  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate(pipeline),
    transactionModel.aggregate(countPipeline)
  ]);

  const totalResults = totalCount[0]?.total || 0;

  return {
    result,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      month,
      year
    }
  };
};


const getAllRefundData = async (option = {}) => {

  let {
    page = 1,
    limit = 10,
    month,
    year,
    search
  } = option;

  /* ---------------- SAFE PAGINATION ---------------- */

  page = Math.max(1, Number(page) || 1);
  limit = Math.max(1, Number(limit) || 10);

  const skip = (page - 1) * limit;

  /* ---------------- MONTH / YEAR FILTER ---------------- */

  const now = new Date();

  month = Number(month);
  year = Number(year);

  // Default → Last Month
  if (!month || !year || isNaN(month) || isNaN(year)) {

    const lastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    month = lastMonth.getMonth() + 1;
    year = lastMonth.getFullYear();
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const matchStage = {
    $match: {
      createdAt: {
        $gte: startDate,
        $lt: endDate
      },
      $or: [
        { payout_status: "refund" },
        { payment_status: "refunded" },
        { status: "refunded" }
      ]
    }
  };

  /* ---------------- MAIN PIPELINE ---------------- */

  const pipeline = [

    matchStage,

    { $sort: { createdAt: -1 } },

    /* USER INFO */
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "userInfo"
      }
    },
    { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },

    /* BOOKING INFO */
    {
      $lookup: {
        from: "bookings",
        localField: "booking",
        foreignField: "_id",
        as: "bookingInfo"
      }
    },
    { $unwind: { path: "$bookingInfo", preserveNullAndEmptyArrays: true } },

    /* SEARCH FILTER */
    ...(search
      ? [{
        $match: {
          $or: [
            {
              "userInfo.fullName": {
                $regex: search,
                $options: "i"
              }
            },
            {
              "bookingInfo.bookingId": {
                $regex: search,
                $options: "i"
              }
            },
            {
              "bookingInfo.reason": {
                $regex: search,
                $options: "i"
              }
            }
          ]
        }
      }]
      : []),

    { $skip: skip },
    { $limit: limit },

    /* FINAL RESPONSE */
    {
      $project: {
        _id: 1,
        bookingId: "$bookingInfo.bookingId",
        userName: "$userInfo.fullName",
        reason: "$bookingInfo.reason",
        amount: "$net_amount",
        createdAt: 1
      }
    }
  ];

  /* ---------------- COUNT PIPELINE ---------------- */

  const countPipeline = [

    matchStage,

    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "userInfo"
      }
    },
    { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },

    {
      $lookup: {
        from: "bookings",
        localField: "booking",
        foreignField: "_id",
        as: "bookingInfo"
      }
    },
    { $unwind: { path: "$bookingInfo", preserveNullAndEmptyArrays: true } },

    ...(search
      ? [{
        $match: {
          $or: [
            { "userInfo.fullName": { $regex: search, $options: "i" } },
            { "bookingInfo.bookingId": { $regex: search, $options: "i" } },
            { "bookingInfo.reason": { $regex: search, $options: "i" } }
          ]
        }
      }]
      : []),

    { $count: "total" }
  ];

  /* ---------------- EXECUTE ---------------- */

  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate(pipeline),
    transactionModel.aggregate(countPipeline)
  ]);

  const totalResults = totalCount[0]?.total || 0;

  return {
    result,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      month,
      year
    }
  };
};


const withdrawCreditService = async (user, amount) => {
  amount = Number(amount);
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new ApiError(400, 'Invalid amount');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userData = await userModel.findById(user).select('digitalWallet email payoutFrequency').session(session);
    if (!userData) {
      throw new ApiError(404, 'User not found');
    }

    if (amount > userData.digitalWallet) {
      throw new ApiError(412, 'Insufficient balance');
    }

    userData.digitalWallet = Number((userData.digitalWallet - amount).toFixed(2));
    await userData.save({ session });

    const tx_ref = `withdraw_${Date.now()}_${user}`;

    // Create payout cycle for instant payout
    const cycle = await getOrCreateCycle(user, 'instant');

    const [transaction] = await transactionModel.create([
      {
        tx_ref,
        user,
        partner: user,
        user_email: userData.email,
        currency: 'NGN',
        gross_amount: amount,
        commission: 0,
        net_amount: amount,
        status: 'successful',
        payment_status: 'successful',
        payment_method: 'wallet',
        payout_status: 'pending',
        payoutCycle: cycle._id,
        paymentType: 'withdraw',
        description: 'Wallet withdrawal'
      }
    ], { session, ordered: true });

    // Add transaction to payout cycle
    await payoutCycleModel.updateOne(
      { _id: cycle._id },
      {
        $addToSet: { transactions: transaction._id },
        $inc: { totalAmount: amount }
      },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return transaction;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};


// const allPayoutOfAPartnerService = async (user, option = {}) => {
// console.log("all transaction for partner")
//   let {
//     page = 1,
//     limit = 10,
//   } = option;

//   page = Number(page);
//   limit = Number(limit);

//   const skip = (page - 1) * limit;

//   const matchStage = {
//     partner: new mongoose.Types.ObjectId(user), //changed for /transaction/partner/all-payout
//     // user: new mongoose.Types.ObjectId(user),
//   };

//   const now = new Date();
//   const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//   const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
//   const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
//   const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

//   const [result, totalCount, lastMonthAvailableAgg, totalPendingAgg] = await Promise.all([

//     transactionModel.aggregate([
//       { $match: matchStage },
//       { $sort: { createdAt: -1 } },
//       { $skip: skip },
//       { $limit: limit },
//       {
//         $lookup: {
//           from: "services",
//           localField: "service",
//           foreignField: "_id",
//           as: "serviceInfo"
//         }
//       },
//       { $unwind: { path: "$serviceInfo", preserveNullAndEmptyArrays: true } },
//       {
//         $addFields: {
//           serviceNameDisplay: {
//             $cond: [
//               { $eq: ["$paymentType", "withdraw"] },
//               "withdraw",
//               "$serviceInfo.name"
//             ]
//           }
//         }
//       },
//       {
//         $project: {
//           _id: 0,
//           amount: "$net_amount",
//           gross_amount: 1,
//           commission: 1,
//           createdAt: 1,
//           transaction_id: 1,
//           paymentType: 1,
//           serviceName: "$serviceNameDisplay"
//         }
//       }
//     ]),


//     transactionModel.aggregate([
//       { $match: matchStage },
//       { $count: "total" },
//     ]),

//     transactionModel.aggregate([
//       {
//         $match: {
//           user: new mongoose.Types.ObjectId(user),
//           payout_status: { $in: ["pending", "hold"] },
//           payment_status: { $in: ["successful", "cancellation-fee"] },
//           paymentType: { $ne: "withdraw" },
//           createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd }
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           total: { $sum: "$net_amount" }
//         }
//       }
//     ]),

//     transactionModel.aggregate([
//       {
//         $match: {
//           user: new mongoose.Types.ObjectId(user),
//           payout_status: { $in: ["pending", "hold"] },
//           payment_status: { $in: ["successful", "cancellation-fee"] },
//           paymentType: { $ne: "withdraw" },
//           createdAt: { $gte: currentMonthStart, $lt: currentMonthEnd }
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           total: { $sum: "$net_amount" }
//         }
//       }
//     ])
//   ]);

//   const totalResults = totalCount[0]?.total || 0;
//   const availableForPayoutBalanceFromLastMonth = lastMonthAvailableAgg[0]?.total || 0;
//   const totalPendingPayout = totalPendingAgg[0]?.total || 0;

//   return {
//     result,
//     availableForPayoutBalanceFromLastMonth,
//     totalPendingPayout,
//     pagination: {
//       totalResults,
//       totalPages: Math.ceil(totalResults / limit),
//       currentPage: page,
//       limit,
//     },
//   };
// };



const allPayoutOfAPartnerService = async (user, option = {}) => {
  console.log("all transaction for partner");

  let { page = 1, limit = 10 } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;

  const matchStage = {
    $or: [
      { partner: new mongoose.Types.ObjectId(user) }, //changed for /transaction/partner/all-payout
      { user: new mongoose.Types.ObjectId(user), paymentType: { $in: ["withdraw", 'credit'] } } // Include withdraw transactions for the user,
    ],
  };

  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate([
      {
        $match: matchStage,
      },

      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      // lookup service (SAFE)
      {
        $lookup: {
          from: "services",
          localField: "service",
          foreignField: "_id",
          as: "serviceInfo",
        },
      },

      // DO NOT UNWIND (important fix)
      // {
      //   $addFields: {
      //     serviceNameDisplay: {
      //       $cond: [
      //         { $eq: ["$paymentType", "withdraw"] },
      //         "withdraw",
      //         {
      //           $ifNull: [
      //             { $arrayElemAt: ["$serviceInfo.name", 0] },
      //             "unknown service",
      //           ],
      //         },
      //       ],
      //     },
      //   },
      // },
      {
        $addFields: {
          serviceNameDisplay: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$paymentType", "withdraw"] },
                  then: "Withdraw",
                },
                {
                  case: { $eq: ["$paymentType", "credit"] },
                  then: "Recharge credit",
                },
              ],
              default: {
                $ifNull: [
                  { $arrayElemAt: ["$serviceInfo.name", 0] },
                  "Unknown service",
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          amount: "$net_amount",
          gross_amount: 1,
          commission: 1,
          createdAt: 1,
          transaction_id: 1,
          paymentType: 1,
          payout_status: 1,
          title: "$serviceNameDisplay",
        },
      },
    ]),

    transactionModel.aggregate([
      {
        $match: matchStage,
      },
      {
        $count: "total",
      },
    ]),
  ]);

  const totalResults = totalCount[0]?.total || 0;

  return {
    result,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
    },
  };
};


const getPlatformEarningTransactionsService = async (option = {}) => {

  let {
    page = 1,
    limit = 10,
    month,
    year,
    search,
    paymentType,
    role
  } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;

  const now = new Date();

  month = Number(month) || now.getMonth() + 1;
  year = Number(year) || now.getFullYear();

  // ================= MATCH =================
  const matchConditions = {
    payment_status: "successful",
    $expr: {
      $and: [
        { $eq: [{ $month: "$createdAt" }, month] },
        { $eq: [{ $year: "$createdAt" }, year] }
      ]
    }
  };

  // ================= FILTER: paymentType =================
  if (paymentType) {
    matchConditions.paymentType = paymentType;
  }

  const basePipeline = [
    { $match: matchConditions },

    // USER INFO
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "userInfo"
      }
    },
    { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },

    // PARTNER INFO
    {
      $lookup: {
        from: "users",
        localField: "partner",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    { $unwind: { path: "$partnerInfo", preserveNullAndEmptyArrays: true } },

    // ================= CALCULATED FIELDS =================
    {
      $addFields: {

        type: {
          $cond: [
            { $eq: ["$paymentType", "credit"] },
            "credit",
            "commission"
          ]
        },

        amount: {
          $cond: [
            { $eq: ["$paymentType", "credit"] },
            "$net_amount",
            "$commission"
          ]
        },

        roleName: {
          $cond: [
            { $eq: ["$paymentType", "credit"] },
            "$userInfo.role",
            "partner"
          ]
        },

        actorName: {
          $cond: [
            { $eq: ["$paymentType", "credit"] },
            "$userInfo.fullName",
            "$partnerInfo.fullName"
          ]
        }
      }
    }
  ];

  // ================= FILTER: role =================
  if (role) {
    basePipeline.push({
      $match: {
        roleName: role
      }
    });
  }

  // ================= SEARCH =================
  if (search) {
    basePipeline.push({
      $match: {
        $or: [
          { tx_ref: { $regex: search, $options: "i" } },
          { transaction_id: { $regex: search, $options: "i" } },
          { actorName: { $regex: search, $options: "i" } }
        ]
      }
    });
  }

  // ================= RESULT =================
  const resultPipeline = [
    ...basePipeline,

    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },

    {
      $project: {
        _id: 1,
        tx_ref: 1,
        transaction_id: 1,

        amount: 1,
        type: 1,
        roleName: 1,
        actorName: 1,

        paymentType: 1,
        currency: 1,
        payment_method: 1,
        createdAt: 1
      }
    }
  ];

  // ================= COUNT =================
  const countPipeline = [
    ...basePipeline,
    { $count: "total" }
  ];

  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate(resultPipeline),
    transactionModel.aggregate(countPipeline)
  ]);

  return {
    result,
    pagination: {
      totalResults: totalCount[0]?.total || 0,
      totalPages: Math.ceil((totalCount[0]?.total || 0) / limit),
      currentPage: page,
      limit,
      month,
      year
    }
  };
};




const getAllPayoutService = async (option = {}) => {
  let {
    page = 1,
    limit = 10,
    month,
    year,
    status,
    search,
    payoutType
  } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;

  const now = new Date();

  // Default last month
  if (!month || !year || isNaN(month) || isNaN(year)) {
    const lastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    month = lastMonth.getMonth() + 1;
    year = lastMonth.getFullYear();
  }

  month = Number(month);
  year = Number(year);

  const matchStage = {
    $match: {
      $expr: {
        $and: [
          { $eq: [{ $month: "$createdAt" }, month] },
          { $eq: [{ $year: "$createdAt" }, year] }
        ]
      }
    }
  };

  if (status) {
    matchStage.$match.payout_status = status;
  }

  const basePipeline = [
    matchStage,

    {
      $group: {
        _id: {
          partner: "$partner",
          payout_status: "$payout_status"
        },
        total_net_amount: {
          $sum: {
            $cond: [
              { $eq: ["$paymentType", "withdraw"] },
              0,
              "$net_amount"
            ]
          }
        },
        wallet_balance: {
          $sum: {
            $cond: [
              { $eq: ["$paymentType", "withdraw"] },
              "$net_amount",
              0
            ]
          }
        },
        total_transactions: { $sum: 1 },
        payoutCycle: { $first: "$payoutCycle" }
      }
    },

    //  bank where isManual = false
    {
      $lookup: {
        from: "banks",
        let: { partnerId: "$_id.partner" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$partnerId"] },
                  { $eq: ["$isManual", false] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "bankInfo"
      }
    },
    {
      $unwind: {
        path: "$bankInfo",
        preserveNullAndEmptyArrays: true
      }
    },

    {
      $lookup: {
        from: "users",
        localField: "_id.partner",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    {
      $unwind: {
        path: "$partnerInfo",
        preserveNullAndEmptyArrays: true
      }
    },

    // PAYOUT CYCLE INFO (get the type)
    {
      $lookup: {
        from: "payoutcycles",
        localField: "payoutCycle",
        foreignField: "_id",
        as: "payoutCycleInfo"
      }
    },
    {
      $unwind: {
        path: "$payoutCycleInfo",
        preserveNullAndEmptyArrays: true
      }
    },

    // FILTER BY PAYOUT TYPE
    ...(payoutType
      ? [{
        $match: {
          "payoutCycleInfo.type": payoutType
        }
      }]
      : [])
  ];

  if (search) {
    basePipeline.push({
      $match: {
        $or: [
          { "partnerInfo.fullName": { $regex: search, $options: "i" } },
          { "partnerInfo.email": { $regex: search, $options: "i" } },
          { "bankInfo.account_name": { $regex: search, $options: "i" } },
          { "bankInfo.account_number": { $regex: search, $options: "i" } },
          { "bankInfo.bank_name": { $regex: search, $options: "i" } }
        ]
      }
    });
  }

  const resultPipeline = [
    ...basePipeline,

    { $sort: { total_net_amount: -1 } },
    { $skip: skip },
    { $limit: limit },

    {
      $project: {
        _id: 0,

        partnerId: "$partnerInfo._id",
        partnerName: "$partnerInfo.fullName",
        // partnerEmail: "$partnerInfo.email",

        month,
        year,

        payout_status: "$_id.payout_status",

        total_gross_amount: 1,
        total_commission: 1,
        total_net_amount: 1,
        wallet_balance: 1,
        overall_amount: { $add: ["$total_net_amount", "$wallet_balance"] },
        total_transactions: 1,

        payoutType: "$payoutCycleInfo.type",

        bankName: "$bankInfo.bank_name",
        account_name: "$bankInfo.account_name",
        account_number: "$bankInfo.account_number"
      }
    }
  ];

  const countPipeline = [
    ...basePipeline,
    { $count: "total" }
  ];

  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate(resultPipeline),
    transactionModel.aggregate(countPipeline)
  ]);

  const totalResults = totalCount[0]?.total || 0;

  return {
    result,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      month,
      year
    }
  };
};

const getcompletePayoutService = async (option = {}) => {

  let {
    page = 1,
    limit = 10,
    month,
    year,
    status,
    search
  } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;


  const now = new Date();

  if (!month || !year || isNaN(month) || isNaN(year)) {
    const lastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    month = lastMonth.getMonth() + 1;
    year = lastMonth.getFullYear();
  }

  month = Number(month);
  year = Number(year);


  const matchStage = {
    $match: {
      payout_status: "completed",
      $expr: {
        $and: [
          { $eq: [{ $month: "$createdAt" }, month] },
          { $eq: [{ $year: "$createdAt" }, year] }
        ]
      }
    }
  };

  if (status) {
    matchStage.$match.payout_status = status;
  }


  const basePipeline = [
    matchStage,

    // GROUP BY PARTNER
    {
      $group: {
        _id: "$partner",
        total_gross_amount: { $sum: "$gross_amount" },
        total_commission: { $sum: "$commission" },
        total_net_amount: { $sum: "$net_amount" },
        total_transactions: { $sum: 1 }
      }
    },

    {
      $lookup: {
        from: "banks",
        localField: "_id",
        foreignField: "user",
        as: "bankInfo"
      }
    },
    {
      $unwind: {
        path: "$bankInfo",
        preserveNullAndEmptyArrays: true
      }
    }
  ];


  if (search) {
    basePipeline.push({
      $match: {
        $or: [
          { "bankInfo.account_name": { $regex: search, $options: "i" } },
          { "bankInfo.account_number": { $regex: search, $options: "i" } },
          { "bankInfo.bank_name": { $regex: search, $options: "i" } }
        ]
      }
    });
  }


  const resultPipeline = [
    ...basePipeline,

    { $sort: { total_net_amount: -1 } },
    { $skip: skip },
    { $limit: limit },

    // PARTNER INFO
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    {
      $unwind: {
        path: "$partnerInfo",
        preserveNullAndEmptyArrays: true
      }
    },

    {
      $project: {
        _id: 0,

        partnerId: "$partnerInfo._id",
        partnerName: "$partnerInfo.fullName",
        partnerEmail: "$partnerInfo.email",

        total_gross_amount: 1,
        total_commission: 1,
        total_net_amount: 1,
        total_transactions: 1,

        bankName: "$bankInfo.bank_name",
        account_name: "$bankInfo.account_name",
        account_number: "$bankInfo.account_number"
      }
    }
  ];

  const countPipeline = [
    ...basePipeline,
    { $count: "total" }
  ];


  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate(resultPipeline),
    transactionModel.aggregate(countPipeline)
  ]);

  const totalResults = totalCount[0]?.total || 0;

  return {
    result,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      month,
      year
    }
  };
};


const getPartnerMonthlySummaryService = async (option = {}) => {

  let {
    page = 1,
    limit = 10,
    month,
    year,
    search,
    payout_status
  } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;

  const now = new Date();

  //  Default last month if not provided
  if (!month || !year || isNaN(month) || isNaN(year)) {
    const lastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    month = lastMonth.getMonth() + 1;
    year = lastMonth.getFullYear();
  }

  month = Number(month);
  year = Number(year);

  //  Dynamic payout status filter
  let payoutStatusFilter = ["pending", "hold", "cancellation-fee"];

  if (payout_status) {
    payoutStatusFilter = payout_status
      .split(",")
      .map(status => status.trim());
  }

  //  MATCH STAGE
  const matchStage = {
    $match: {
      payout_status: { $in: payoutStatusFilter },
      $expr: {
        $and: [
          { $eq: [{ $month: "$createdAt" }, month] },
          { $eq: [{ $year: "$createdAt" }, year] }
        ]
      }
    }
  };

  // ================= BASE PIPELINE =================
  const basePipeline = [

    matchStage,

    // GROUP BY PARTNER + STATUS
    {
      $group: {
        _id: {
          partner: "$partner",
          payout_status: "$payout_status"
        },
        total_gross_amount: { $sum: "$gross_amount" },
        total_commission: { $sum: "$commission" },
        total_net_amount: {
          $sum: {
            $cond: [
              { $eq: ["$paymentType", "withdraw"] },
              0,
              "$net_amount"
            ]
          }
        },
        wallet_balance: {
          $sum: {
            $cond: [
              { $eq: ["$paymentType", "withdraw"] },
              "$net_amount",
              0
            ]
          }
        },
        total_transactions: { $sum: 1 }
      }
    },

    // Partner Info
    {
      $lookup: {
        from: "users",
        localField: "_id.partner",
        foreignField: "_id",
        as: "partnerInfo"
      }
    },
    {
      $unwind: {
        path: "$partnerInfo",
        preserveNullAndEmptyArrays: true
      }
    },

    // Bank Info (only isManual = false)
    {
      $lookup: {
        from: "banks",
        let: { partnerId: "$_id.partner" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user", "$$partnerId"] },
                  { $eq: ["$isManual", false] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "bankInfo"
      }
    },
    {
      $unwind: {
        path: "$bankInfo",
        preserveNullAndEmptyArrays: true
      }
    }
  ];

  // ================= SEARCH FILTER =================
  if (search) {
    basePipeline.push({
      $match: {
        $or: [
          { "partnerInfo.fullName": { $regex: search, $options: "i" } },
          { "partnerInfo.email": { $regex: search, $options: "i" } },
          { "bankInfo.account_name": { $regex: search, $options: "i" } },
          { "bankInfo.account_number": { $regex: search, $options: "i" } },
          { "bankInfo.bank_name": { $regex: search, $options: "i" } }
        ]
      }
    });
  }

  // ================= RESULT PIPELINE =================
  const resultPipeline = [

    ...basePipeline,

    { $sort: { "_id.partner": 1, "_id.payout_status": 1 } },

    { $skip: skip },
    { $limit: limit },

    {
      $project: {
        _id: 0,

        partnerId: "$partnerInfo._id",
        partnerName: "$partnerInfo.fullName",
        partnerEmail: "$partnerInfo.email",

        payout_status: "$_id.payout_status",

        total_gross_amount: 1,
        total_commission: 1,
        total_net_amount: 1,
        wallet_balance: 1,
        overall_amount: { $add: ["$total_net_amount", "$wallet_balance"] },
        total_transactions: 1,

        bankName: "$bankInfo.bank_name",
        account_name: "$bankInfo.account_name",
        account_number: "$bankInfo.account_number"
      }
    }
  ];

  // ================= COUNT PIPELINE =================
  const countPipeline = [
    ...basePipeline,
    { $count: "total" }
  ];

  // ================= EXECUTE =================
  const [result, totalCount] = await Promise.all([
    transactionModel.aggregate(resultPipeline),
    transactionModel.aggregate(countPipeline)
  ]);

  const totalResults = totalCount[0]?.total || 0;

  return {
    result,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      month,
      year
    }
  };
};



const holdPayoutService = async ({
  partnerId,
  month,
  year,
  status
}) => {
  if (!partnerId || !month || !year) {
    throw new Error("partnerId, month and year are required");
  }

  month = Number(month);
  year = Number(year);

  const result = await transactionModel.updateMany(
    {
      partner: new mongoose.Types.ObjectId(String(partnerId)),

      payout_status: "pending",

      $expr: {
        $and: [
          { $eq: [{ $month: "$createdAt" }, month] },
          { $eq: [{ $year: "$createdAt" }, year] }
        ]
      }
    },
    {
      $set: {
        payout_status: 'hold'
      }
    }
  );

  return {
    modifiedCount: result.modifiedCount
  };
};



const getPartnerMonthlyCompletedPayoutService = async (option = {}) => {

  let {
    page = 1,
    limit = 10,
    month,
    year,
    search,
    payoutType
  } = option;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;

  const now = new Date();
  const currentYear = now.getFullYear();

  year = Number(year) || currentYear;

  // ================= MATCH - use date range for index-friendly query =================
  let startDate, endDate;

  if (month) {
    month = Number(month);
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 1);
  } else {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year + 1, 0, 1);
  }

  const matchConditions = {
    payout_status: "completed",
    $or: [
      { payout_completed_at: { $gte: startDate, $lt: endDate } },
      { payout_completed_at: { $exists: false }, updatedAt: { $gte: startDate, $lt: endDate } }
    ]
  };

  // ================= PIPELINE USING $facet =================
  const pipeline = [
    { $match: matchConditions },

    // GROUP
    {
      $group: {
        _id: {
          partner: "$partner",
          month: {
            $month: { $ifNull: ["$payout_completed_at", "$updatedAt"] }
          },
          year: {
            $year: { $ifNull: ["$payout_completed_at", "$updatedAt"] }
          }
        },
        total_gross_amount: { $sum: "$gross_amount" },
        total_commission: { $sum: "$commission" },
        total_net_amount: {
          $sum: {
            $cond: [
              { $eq: ["$paymentType", "withdraw"] },
              0,
              "$net_amount"
            ]
          }
        },
        wallet_balance: {
          $sum: {
            $cond: [
              { $eq: ["$paymentType", "withdraw"] },
              "$net_amount",
              0
            ]
          }
        },
        total_transactions: { $sum: 1 },
        payoutCycle: { $first: "$payoutCycle" }
      }
    },

    { $sort: { "_id.year": -1, "_id.month": -1 } },

    // $facet splits into metadata (total count) + paginated data
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [
          { $skip: skip },
          { $limit: limit },

          // LOOKUPS on paginated data only
          {
            $lookup: {
              from: "users",
              localField: "_id.partner",
              foreignField: "_id",
              as: "partnerInfo"
            }
          },
          { $unwind: { path: "$partnerInfo", preserveNullAndEmptyArrays: true } },

          {
            $lookup: {
              from: "banks",
              let: { partnerId: "$_id.partner" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$user", "$$partnerId"] },
                        { $eq: ["$isManual", false] }
                      ]
                    }
                  }
                },
                { $limit: 1 }
              ],
              as: "bankInfo"
            }
          },
          { $unwind: { path: "$bankInfo", preserveNullAndEmptyArrays: true } },

          {
            $lookup: {
              from: "payoutcycles",
              localField: "payoutCycle",
              foreignField: "_id",
              as: "payoutCycleInfo"
            }
          },
          { $unwind: { path: "$payoutCycleInfo", preserveNullAndEmptyArrays: true } },

          // FILTERS after lookups
          ...(payoutType
            ? [{
              $match: {
                "payoutCycleInfo.type": payoutType
              }
            }]
            : []),

          ...(search
            ? [{
              $match: {
                $or: [
                  { "partnerInfo.fullName": { $regex: search, $options: "i" } },
                  { "bankInfo.account_name": { $regex: search, $options: "i" } },
                  { "bankInfo.account_number": { $regex: search, $options: "i" } }
                ]
              }
            }]
            : []),

          {
            $project: {
              _id: 0,

              month: "$_id.month",
              year: "$_id.year",

              partnerId: "$partnerInfo._id",
              partnerName: "$partnerInfo.fullName",
              partnerEmail: "$partnerInfo.email",
              payoutType: "$payoutCycleInfo.type",

              total_gross_amount: 1,
              total_commission: 1,
              total_net_amount: 1,
              wallet_balance: 1,
              overall_amount: { $add: ["$total_net_amount", "$wallet_balance"] },
              total_transactions: 1,

              bankName: "$bankInfo.bank_name",
              account_name: "$bankInfo.account_name",
              account_number: "$bankInfo.account_number"
            }
          }
        ]
      }
    }
  ];

  const facetResult = await transactionModel.aggregate(pipeline);

  const metadata = facetResult[0]?.metadata || [];
  const result = facetResult[0]?.data || [];
  const totalResults = metadata.length > 0 ? metadata[0].total : 0;

  return {
    result,
    pagination: {
      totalResults,
      totalPages: Math.ceil(totalResults / limit),
      currentPage: page,
      limit,
      month: month || null,
      year
    }
  };
};




const comnpletePayoutService = async ({
  partnerId,
  month,
  year,
  status,
}) => {
  month = Number(month);
  year = Number(year);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const result = await transactionModel.updateMany(
    {
      partner: new mongoose.Types.ObjectId(partnerId),
      payout_status: status,
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    },
    {
      $set: {
        payout_status: "completed",
        payout_completed_at: new Date(),
      },
    }
  );

  return result;
};



module.exports = {
  getAllTransactions,
  comnpletePayoutService,
  // getPendingPayoutService,
  holdPayoutService,
  getcompletePayoutService,
  getPartnerMonthlySummaryService,
  getPartnerMonthlyCompletedPayoutService,
  getAllPayoutService,
  getPlatformEarningTransactionsService,
  allPayoutOfAPartnerService,
  getAllRefundData,
  withdrawCreditService
};