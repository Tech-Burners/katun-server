const PayoutCycle = require("./payoutCycle.model");
const Transaction = require("../Transaction/transaction.model");
const payoutCycleModel = require("./payoutCycle.model");
const transactionModel = require("../Transaction/transaction.model");
const userModel = require("../User/user.model");
const { default: mongoose } = require("mongoose");
const ApiError = require("../../helpers/ApiError");
const { sendNotificationByFcmToken } = require("../../helpers/sendNotificationByFcmToken");
const { addNotificationService } = require("../Notification/notification.service");


/**
 * MAIN: Create payout from cycle
 */
const createPayout = async (cycleId) => {
  const cycle = await payoutCycleModel.findById(cycleId).populate("partner");

  if (!cycle) return;

  const transactions = await Transaction.find({
    payoutCycle: cycleId,
    payout_status: "pending",
  });

  if (!transactions.length) return;

  const totalAmount = transactions.reduce(
    (sum, t) => sum + t.net_amount,
    0
  );

  const payout = await Payout.create({
    partner: cycle.partner._id,
    payoutCycle: cycleId,
    totalAmount,
    status: "pending",
  });

  // mark transactions as locked
  await Transaction.updateMany(
    { _id: { $in: transactions.map(t => t._id) } },
    { $set: { payout_status: "processing" } }
  );

  return payout;
};



const updatePayoutFrequency = async (userId, newFrequency) => {
  const user = await userModel.findById(userId);
  // console.log({user})

  const lastChange = user.lastFrequencyChange || new Date(0);
  // console.log({ lastChange });
  const diffDays = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
  console.log(`Days since last change: ${diffDays.toFixed(2)}`);

  // // BLOCK frequent changes (30 days rule)
  if (diffDays < 30) {
    throw new ApiError(
      406,
      `Payout frequency can only be changed once every 30 days. Please try again in ${Math.ceil(30 - diffDays)} day(s).`
    )
  }

  user.payoutFrequency = newFrequency;
  user.lastFrequencyChange = new Date();

  await user.save();

  return user;
};


const getOrCreateCycle = async (partnerId, type) => {
  // console.log({ type });
  const now = new Date();

  let cycle = await payoutCycleModel.findOne({
    partner: partnerId,
    type,
    // status: "open",
    startDate: { $lte: now },//insteed open
    endDate: { $gte: now },//insteed open
  });

  if (cycle) return cycle;

  let startDate = new Date(now);
  let endDate = new Date(now);

  if (type === "weekly") {
    const day = now.getDay();
    startDate.setDate(now.getDate() - day);
    endDate.setDate(startDate.getDate() + 6);
  }

  if (type === "monthly") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  if (type === "instant") {
    startDate = new Date(now);
    endDate = new Date(now);
    console.log("Instant payout cycle created with start and end date as now.");
  }

  // console.log({
  //   partner: partnerId,
  //   type,
  //   startDate,
  //   endDate,
  //   status: "open",
  // });
  cycle = await payoutCycleModel.create({
    partner: partnerId,
    type,
    startDate,
    endDate,
    status: "open",
  });

  return cycle;
};



// const getPendingPayouts = async (query = {}) => {
//   const page = Number(query.page) || 1;
//   const limit = Number(query.limit) || 10;
//   const skip = (page - 1) * limit;

//   const now = new Date();

//   const match = {
//     endDate: { $lte: now },
//     status: { $in: ["open", "processing"] },
//   };

//   const cycles = await PayoutCycle.find(match)
//     .populate("partner", "fullName email payoutFrequency")
//     .sort({ endDate: 1 })
//     .skip(skip)
//     .limit(limit);

//   const total = await PayoutCycle.countDocuments(match);

//   // attach transaction summary
//   const result = await Promise.all(
//     cycles.map(async (cycle) => {
//       const transactions = await Transaction.find({
//         payoutCycle: cycle._id,
//       });

//       const totalAmount = transactions.reduce(
//         (sum, t) => sum + t.net_amount,
//         0
//       );

//       return {
//         cycleId: cycle._id,
//         partner: cycle.partner,
//         type: cycle.type,
//         startDate: cycle.startDate,
//         endDate: cycle.endDate,
//         status: cycle.status,
//         totalTransactions: transactions.length,
//         totalAmount,
//       };
//     })
//   );

//   return {
//     result,
//     pagination: {
//       total,
//       page,
//       totalPages: Math.ceil(total / limit),
//     },
//   };
// };



const getMyFrequencyService = async (userId) => {
  const user = await userModel.findById(userId).select("payoutFrequency lastFrequencyChange");
  return user;
};


// const getPendingPayoutListService = async (options = {}) => {
//   let {
//     page = 1,
//     limit = 10,
//     search = "",
//     status,
//     payoutfrequency,
//     payoutType,
//     month,
//     year,
//   } = options;

//   page = Number(page);
//   limit = Number(limit);

//   const skip = (page - 1) * limit;
//   const now = new Date();

//   const initialMatch = status
//     ? { payout_status: status }
//     : { payout_status: { $in: ["pending", "hold"] } };

//   // Default last month
//   if (!month || !year || isNaN(month) || isNaN(year)) {
//     const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//     month = lastMonth.getMonth() + 1;
//     year = lastMonth.getFullYear();
//   }

//   month = Number(month);
//   year = Number(year);

//   initialMatch.$expr = {
//     $and: [
//       { $eq: [{ $month: "$createdAt" }, month] },
//       { $eq: [{ $year: "$createdAt" }, year] },
//     ],
//   };

//   const pipeline = [
//     {
//       $match: initialMatch,
//     },

//     {
//       $group: {
//         _id: {
//           cycle: "$payoutCycle",
//           paymentType: "$paymentType",
//           txId: "$_id", //  prevents instant merge
//         },

//         cycle: { $first: "$payoutCycle" },
//         partner: { $first: "$partner" },
//         paymentType: { $first: "$paymentType" },
//         payout_status: { $first: "$payout_status" },

//         createdAt: { $first: "$createdAt" }, //  needed for sorting

//         total_gross_amount: { $sum: "$gross_amount" },
//         total_commission: { $sum: "$commission" },
//         total_net_amount: { $sum: "$net_amount" },

//         wallet_balance: {
//           $sum: {
//             $cond: [
//               { $eq: ["$paymentType", "withdraw"] },
//               "$net_amount",
//               0,
//             ],
//           },
//         },

//         total_transactions: { $sum: 1 },
//       },
//     },

//     {
//       $lookup: {
//         from: "users",
//         localField: "partner",
//         foreignField: "_id",
//         as: "partner",
//       },
//     },
//     {
//       $unwind: {
//         path: "$partner",
//         preserveNullAndEmptyArrays: true,
//       },
//     },

//     ...(payoutfrequency
//       ? [
//           {
//             $match: {
//               "partner.payoutfrequency": payoutfrequency,
//             },
//           },
//         ]
//       : []),

//     {
//       $lookup: {
//         from: "banks",
//         let: { partnerId: "$partner._id" },
//         pipeline: [
//           {
//             $match: {
//               $expr: {
//                 $eq: ["$user", "$$partnerId"],
//               },
//             },
//           },
//           { $limit: 1 },
//         ],
//         as: "bank",
//       },
//     },
//     {
//       $unwind: {
//         path: "$bank",
//         preserveNullAndEmptyArrays: true,
//       },
//     },

//     ...(search
//       ? [
//           {
//             $match: {
//               $or: [
//                 {
//                   "bank.account_name": {
//                     $regex: search,
//                     $options: "i",
//                   },
//                 },
//                 {
//                   "bank.account_number": {
//                     $regex: search,
//                     $options: "i",
//                   },
//                 },
//               ],
//             },
//           },
//         ]
//       : []),

//     // 5️⃣ CYCLE
//     {
//       $lookup: {
//         from: "payoutcycles",
//         localField: "cycle",
//         foreignField: "_id",
//         as: "cycle",
//       },
//     },
//     {
//       $unwind: {
//         path: "$cycle",
//         preserveNullAndEmptyArrays: true,
//       },
//     },

//     ...(payoutType
//       ? [
//           {
//             $match: {
//               "cycle.type": payoutType,
//             },
//           },
//         ]
//       : []),

//     // 6️⃣ FINAL PROJECT
//     {
//       $project: {
//         _id: 0,

//         cycleId: "$cycle._id",
//         userId: "$partner._id",
//         userName: "$partner.fullName",
//         userEmail: "$partner.email",
//         role: "$partner.role",

//         paymentType: 1,
//         payout_status: 1,

//         total_gross_amount: 1,
//         total_commission: 1,
//         total_net_amount: 1,

//         type: "$cycle.type",

//         wallet_balance: { $ifNull: ["$wallet_balance", 0] },

//         overall_amount: {
//           $add: [
//             "$total_net_amount",
//             { $ifNull: ["$wallet_balance", 0] },
//           ],
//         },

//         total_transactions: 1,

//         bankName: "$bank.bank_name",
//         account_name: "$bank.account_name",
//         account_number: "$bank.account_number",

//         cycleStartDate: "$cycle.startDate",
//         cycleEndDate: "$cycle.endDate",

//         createdAt: 1,
//       },
//     },

//     {
//       $sort: {
//         createdAt: -1,
//       },
//     },

//     {
//       $facet: {
//         metadata: [{ $count: "total" }],
//         data: [{ $skip: skip }, { $limit: limit }],
//       },
//     },
//   ];

//   const facetResult = await transactionModel.aggregate(pipeline);

//   const metadata = facetResult[0]?.metadata || [];
//   const result = facetResult[0]?.data || [];

//   const total = metadata.length > 0 ? metadata[0].total : 0;

//   return {
//     result,
//     pagination: {
//       totalResults: total,
//       totalPage: Math.ceil(total / limit),
//       page,
//       limit,
//     },
//   };
// };


const getPendingPayoutListService = async (options = {}) => {
  let {
    page = 1,
    limit = 10,
    search = "",
    status,
    payoutfrequency,
    payoutType,
    month,
    year,
  } = options;

  page = Number(page);
  limit = Number(limit);

  const skip = (page - 1) * limit;
  const now = new Date();

  // const initialMatch = status
  //   ? { payout_status: status }
  //   : { payout_status: { $in: ["pending", "hold"] } };

  const initialMatch = {
    paymentType: { $ne: "credit" }, // Exclude credit transactions
    ...(status
      ? { payout_status: status }
      : { payout_status: { $in: ["pending", "hold"] } }),
  };

  // Default to last month if month/year not provided
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

  initialMatch.$expr = {
    $and: [
      { $eq: [{ $month: "$createdAt" }, month] },
      { $eq: [{ $year: "$createdAt" }, year] },
    ],
  };

  const pipeline = [
    {
      $match: initialMatch,
    },

    {
      $group: {
        _id: {
          groupKey: {
            $cond: [
              // Instant payouts are always separate
              { $eq: ["$paymentType", "instant"] },
              "$_id",

              // Weekly and Monthly are grouped by payout cycle
              "$payoutCycle"
            ]
          }
        },

        cycle: { $first: "$payoutCycle" },
        partner: { $first: "$partner" },
        paymentType: { $first: "$paymentType" },

        total_gross_amount: { $sum: "$gross_amount" },
        total_commission: { $sum: "$commission" },
        total_net_amount: { $sum: "$net_amount" },

        wallet_balance: {
          $sum: {
            $cond: [
              { $eq: ["$paymentType", "withdraw"] },
              "$net_amount",
              0
            ]
          }
        },

        payout_status: { $first: "$payout_status" },
        total_transactions: { $sum: 1 },

        createdAt: { $max: "$createdAt" }
      }
    },

    // {
    //   $group: {
    //     _id: {
    //       groupKey: {
    //         $cond: [
    //           { $eq: ["$paymentType", "instant"] },
    //           "$_id", // each instant payout stays separate
    //           "$payoutCycle", // normal payouts grouped by cycle
    //         ],
    //       },
    //     },

    //     cycle: { $first: "$payoutCycle" },
    //     partner: { $first: "$partner" },
    //     paymentType: { $first: "$paymentType" },

    //     total_gross_amount: { $sum: "$gross_amount" },
    //     total_commission: { $sum: "$commission" },
    //     total_net_amount: { $sum: "$net_amount" },

    //     wallet_balance: {
    //       $sum: {
    //         $cond: [
    //           { $eq: ["$paymentType", "withdraw"] },
    //           "$net_amount",
    //           0,
    //         ],
    //       },
    //     },

    //     payout_status: { $first: "$payout_status" },
    //     total_transactions: { $sum: 1 },

    //     createdAt: { $max: "$createdAt" },
    //   },
    // },

    {
      $lookup: {
        from: "users",
        localField: "partner",
        foreignField: "_id",
        as: "partner",
      },
    },
    {
      $unwind: {
        path: "$partner",
        preserveNullAndEmptyArrays: true,
      },
    },

    ...(payoutfrequency
      ? [
        {
          $match: {
            "partner.payoutfrequency": payoutfrequency,
          },
        },
      ]
      : []),

    {
      $lookup: {
        from: "banks",
        let: { partnerId: "$partner._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$user", "$$partnerId"],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "bank",
      },
    },
    {
      $unwind: {
        path: "$bank",
        preserveNullAndEmptyArrays: true,
      },
    },

    ...(search
      ? [
        {
          $match: {
            $or: [
              {
                "bank.account_name": {
                  $regex: search,
                  $options: "i",
                },
              },
              {
                "bank.account_number": {
                  $regex: search,
                  $options: "i",
                },
              },
            ],
          },
        },
      ]
      : []),

    {
      $lookup: {
        from: "payoutcycles",
        localField: "cycle",
        foreignField: "_id",
        as: "cycle",
      },
    },
    {
      $unwind: {
        path: "$cycle",
        preserveNullAndEmptyArrays: true,
      },
    },

    ...(payoutType
      ? [
        {
          $match: {
            "cycle.type": payoutType,
          },
        },
      ]
      : []),

    {
      $project: {
        _id: 0,

        cycleId: "$cycle._id",
        userId: "$partner._id",
        userName: "$partner.fullName",
        userEmail: "$partner.email",
        role: "$partner.role",

        payout_status: 1,
        paymentType: 1,

        total_gross_amount: 1,
        total_commission: 1,
        total_net_amount: 1,

        type: "$cycle.type",

        wallet_balance: {
          $ifNull: ["$wallet_balance", 0],
        },

        overall_amount: {
          $add: [
            "$total_net_amount",
            {
              $ifNull: ["$wallet_balance", 0],
            },
          ],
        },

        total_transactions: 1,

        bankName: "$bank.bank_name",
        bank_id: "$bank._id",
        account_name: "$bank.account_name",
        account_number: "$bank.account_number",

        cycleStartDate: "$cycle.startDate",
        cycleEndDate: "$cycle.endDate",
        payoutDueDate: "$cycle.endDate",

        daysRemaining: {
          $max: [
            0,
            {
              $dateDiff: {
                startDate: now,
                endDate: {
                  $ifNull: ["$cycle.endDate", now],
                },
                unit: "day",
              },
            },
          ],
        },

        overdueDays: {
          $cond: [
            {
              $and: [
                { $ne: ["$cycle.endDate", null] },
                { $lt: ["$cycle.endDate", now] },
              ],
            },
            {
              $dateDiff: {
                startDate: "$cycle.endDate",
                endDate: now,
                unit: "day",
              },
            },
            0,
          ],
        },

        createdAt: 1,
      },
    },

    // latest first
    {
      $sort: {
        createdAt: -1,
      },
    },
  ];

  const facetPipeline = [
    {
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ];

  const fullPipeline = [...pipeline, ...facetPipeline];

  const facetResult = await transactionModel.aggregate(fullPipeline);

  const metadata = facetResult[0]?.metadata || [];
  const result = facetResult[0]?.data || [];
  const total = metadata.length > 0 ? metadata[0].total : 0;

  return {
    result,
    pagination: {
      totalResults: total,
      totalPage: Math.ceil(total / limit),
      page,
      limit,
    },
  };
};

const holdPayoutService = async (cycleId) => {

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    await payoutCycleModel.findByIdAndUpdate(
      cycleId,
      {
        status: "hold"
      },
      { session }
    );

    await transactionModel.updateMany(
      {
        payoutCycle: cycleId,
        payout_status: "pending"
      },
      {
        payout_status: "hold"
      },
      { session }
    );

    await session.commitTransaction();

    return true;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};



const completePayoutService = async (cycleId, adminId) => {

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const cycle = await payoutCycleModel.findById(cycleId);

    if (!cycle) {
      throw new Error("Payout cycle not found");
    }

    await payoutCycleModel.findByIdAndUpdate(
      cycleId,
      {
        status: "completed",
        paidAt: new Date(),
        paidBy: adminId
      },
      { session }
    );

    await transactionModel.updateMany(
      {
        payoutCycle: cycleId,
        payout_status: {
          $in: ["pending", "hold"]
        }
      },
      {
        payout_status: "completed",
        payout_completed_at: new Date()
      },
      { session }
    );
    const receiverData = await userModel.findById(cycle.partner);
    // console.log({receiverData})
    if (receiverData?.enabledPushNotification === true) {
      await sendNotificationByFcmToken(
        cycle.partner,
        'payment',
        `Your payout has been completed and will reflect in your account shortly.`
      )
    }
    await addNotificationService(
      {
        sender: adminId,
        targetUser: cycle.partner,
        title: `payment`,
        message: `Your payout has been completed and will reflect in your account shortly.`,
        type: "payment",
      }
    )

    await session.commitTransaction();

    return cycle;

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};



module.exports = {
  createPayout,
  getOrCreateCycle,
  getPendingPayoutListService,
  updatePayoutFrequency,
  holdPayoutService,
  completePayoutService,
  getMyFrequencyService
  // getPendingPayouts
};