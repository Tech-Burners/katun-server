const mongoose = require('mongoose');
const Booking = require('../Booking/booking.model');
const Transaction = require('../Transaction/transaction.model');
const Report = require('../Report/report.model');
const User = require('../User/user.model');
const Service = require('../Service/service.model');
const Category = require('../Category/category.model');
const Partner = require('../Partner/partner.model');
const Employer = require('../Employer/employer.model');
const Employee = require('../Employee/employee.model');
const AllocationManagement = require('../AllocationManagement/allocationManagement.model');

const getCountCardsService = async () => {
  const today = new Date();
  const startOfDay = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  ));

  const endOfDay = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() + 1
  ));

  const totalBookingToday = await Booking.countDocuments({
    date: { $gte: startOfDay, $lt: endOfDay }
  });

  // Overall earning: sum of gross_amount where payment_status successful
  const overallEarningResult = await Transaction.aggregate([
    { $match: { payment_status: 'successful' } },
    { $group: { _id: null, total: { $sum: '$gross_amount' } } }
  ]);
  const overallEarning = overallEarningResult.length > 0 ? overallEarningResult[0].total : 0;

  // Pending payout amount: sum of net_amount where payout_status pending or hold
  const pendingPayoutResult = await Transaction.aggregate([
    { $match: { payout_status: { $in: ['pending', 'hold'] } } },
    { $group: { _id: null, total: { $sum: '$net_amount' } } }
  ]);
  const pendingPayoutAmount = pendingPayoutResult.length > 0 ? pendingPayoutResult[0].total : 0;

  // Open report: count reports with status opened
  const openDisputs = await Report.countDocuments({ status: 'opened' });

  // Total users: count users with role user
  const totalUsers = await User.countDocuments({ role: 'user' });

  // Total employer: count users with role hr
  const totalEmployer = await User.countDocuments({ role: 'hr' });

  // Total providers: count users with role partner
  const totalProviders = await User.countDocuments({ role: 'partner' });

  return {
    totalBookingToday,
    overallEarning,
    pendingPayoutAmount,
    openDisputs,
    totalUsers,
    totalEmployer,
    totalProviders
  };
};





const getPartnerDashboardCount = async (partnerUserId) => {
  console.log('Getting dashboard count for partner user ID:', partnerUserId);
  const partner = await User.findById(partnerUserId)
  if (!partner) {
    throw new Error('Partner not found');
  }

  const upcomingBookings = await Booking.countDocuments({
    provider: partnerUserId,
    status: { $in: ['pending', 'approved'] }
  });

  const completedBookings = await Booking.countDocuments({
    provider: partnerUserId,
    status: 'completed'
  });

  const earnings = await Transaction.aggregate([
    {
      $match: {
        partner: partnerUserId,
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

  const pendingPayouts = await Transaction.countDocuments({
    partner: partnerUserId,
    payout_status: 'pending',
    payment_status: 'successful'
  });

  const pendingPayoutAmounts = await Transaction.aggregate([
    {
      $match: {
        partner: partnerUserId,
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
    avgRating: partner.rating ? parseFloat(partner.rating.toFixed(2)) : 0,
    totalRating: partner.totalRating || 0,
    totalEarning: parseFloat(totalEarning.toFixed(2)),
    pendingPayoutCount: pendingPayouts,
    pendingPayoutAmount: parseFloat(totalPendingPayoutAmount.toFixed(2)),
    digitalWallet: partner.digitalWallet || 0
  };
};

const getPartnerBookingTrend = async (partnerUserId, year) => {
  const partner = await Partner.findOne({ user: partnerUserId, isDeleted: false });
  if (!partner) {
    return Array.from({ length: 12 }, (_, index) => ({
      month: [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ][index],
      bookings: 0
    }));
  }

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

  const bookingTrendAgg = await Booking.aggregate([
    {
      $match: {
        provider: partnerUserId,
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

  return months.map((month, index) => {
    const monthData = bookingTrendAgg.find(r => r._id.month === index + 1);
    return {
      month,
      bookings: monthData ? monthData.count : 0
    };
  });
};

const getPartnerEarningOverview = async (partnerUserId, year) => {
  const partner = await Partner.findOne({ user: partnerUserId, isDeleted: false });
  if (!partner) {
    return {
      earningTrend: Array.from({ length: 12 }, (_, index) => ({
        month: [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ][index],
        earnings: 0
      })),
      yearlyEarning: 0
    };
  }

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

  const earningTrendAgg = await Transaction.aggregate([
    {
      $match: {
        partner: new mongoose.Types.ObjectId(partnerUserId),
        payment_status: 'successful',
        payout_status: 'completed',
        $expr: {
          $and: [
            { $gte: [{ $ifNull: ['$payout_completed_at', '$updatedAt'] }, startDate] },
            { $lte: [{ $ifNull: ['$payout_completed_at', '$updatedAt'] }, endDate] }
          ]
        }
      }
    },
    {
      $group: {
        _id: { month: { $month: { $ifNull: ['$payout_completed_at', '$updatedAt'] } } },
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

  const yearlyEarning = earningTrend.reduce((sum, item) => sum + item.earnings, 0);

  return {
    earningTrend,
    yearlyEarning: parseFloat(yearlyEarning.toFixed(2))
  };
};

const getMonthlyUserRatio = async (year) => {
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31T23:59:59`);

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const result = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { month: { $month: "$createdAt" } },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { "_id.month": 1 }
    }
  ]);

  // Format result for all 12 months, default to 0 if no users
  const formattedResult = months.map((month, index) => {
    const monthData = result.find(r => r._id.month === index + 1);
    return {
      month,
      user: monthData ? monthData.count : 0
    };
  });

  return formattedResult;
};



const getCategoryServiceCount = async (year) => {
  const startDate = new Date(`${year}-01-01`);
  const endDate = new Date(`${year}-12-31T23:59:59`);

  const categories = await Category.find({ isDeleted: false }).select('_id name').lean();

  const serviceCounts = await Service.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        isDeleted: false,
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryInfo'
      }
    },
    { $unwind: '$categoryInfo' },
    {
      $group: {
        _id: {
          categoryId: '$categoryInfo._id',
          categoryName: '$categoryInfo.name'
        },
        count: { $sum: 1 }
      }
    }
  ]);

  const countsByCategory = serviceCounts.reduce((acc, item) => {
    const key = item._id.categoryId.toString();
    acc[key] = {
      categoryId: item._id.categoryId,
      categoryName: item._id.categoryName,
      count: item.count
    };
    return acc;
  }, {});

  const result = categories.map((category) => {
    const key = category._id.toString();
    return {
      categoryId: category._id,
      categoryName: category.name,
      count: countsByCategory[key] ? countsByCategory[key].count : 0
    };
  });

  // Sort by count descending and limit to top 5
  return result.sort((a, b) => b.count - a.count).slice(0, 5);
};

const getHrCardData = async (hrUserId) => {
  const employer = await Employer.findOne({ user: hrUserId, isDeleted: false });

  if (!employer) {
    return {
      availableCredit: 0,
      totalEmployees: 0,
      creditSpentLast30Days: 0,
      adoptionRate: 0
    };
  }

  const availableCredit = employer.creditBalance || 0;
  const totalEmployees = employer.employeeCount || 0;
  const activeEmployees = employer.activeEmployeeCount || 0;
  const adoptionRate = totalEmployees > 0 ? Math.round((activeEmployees / totalEmployees) * 100) : 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const employeeUsers = await Employee.find({ company: employer._id }).select('user').lean();
  const employeeUserIds = employeeUsers.map((employee) => employee.user).filter(Boolean);

  const allocationResult = await AllocationManagement.aggregate([
    {
      $match: {
        user: { $in: employeeUserIds },
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: null,
        totalAllocated: { $sum: '$totalCredit' }
      }
    }
  ]);

  const creditSpentLast30Days = allocationResult.length > 0 ? allocationResult[0].totalAllocated : 0;

  return {
    availableCredit,
    totalEmployees,
    creditSpentLast30Days,
    adoptionRate
  };
};

const getHrCreditSpentTrend = async (hrUserId, year) => {
  const employer = await Employer.findOne({ user: hrUserId, isDeleted: false });

  if (!employer) {
    return Array.from({ length: 12 }, (_, index) => ({
      month: [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ][index],
      creditSpent: 0
    }));
  }

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

  const employeeUsers = await Employee.find({ company: employer._id }).select('user').lean();
  const employeeUserIds = employeeUsers.map((employee) => employee.user).filter(Boolean);

  if (!employeeUserIds.length) {
    return months.map((month) => ({ month, creditSpent: 0 }));
  }

  const allocationResult = await AllocationManagement.aggregate([
    {
      $match: {
        user: { $in: employeeUserIds },
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { month: { $month: '$createdAt' } },
        creditSpent: { $sum: '$totalCredit' }
      }
    },
    {
      $sort: { '_id.month': 1 }
    }
  ]);

  return months.map((month, index) => {
    const monthData = allocationResult.find((item) => item._id.month === index + 1);
    return {
      month,
      creditSpent: monthData ? monthData.creditSpent : 0
    };
  });
};

const getPendingStats = async () => {
  // Partner pending for approval: count where isVerified is false
  const partnerPending = await Partner.countDocuments({ isVerified: false, isDeleted: false });

  // Report pending: count where status is 'opened'
  const reportPending = await Report.countDocuments({ status: 'opened' });

  // Payout pending: count distinct partners with payout_status 'pending'
  const payoutPendingResult = await Transaction.aggregate([
    { $match: { payout_status: 'pending' } },
    { $group: { _id: '$partner' } },
    { $group: { _id: null, count: { $sum: 1 } } }
  ]);

  const payoutPending = payoutPendingResult.length > 0 ? payoutPendingResult[0].count : 0;

  return {
    partnerPending,
    reportPending,
    payoutPending
  };
};

// const getUserWalletAndTransactions = async (userId, options = {}) => {
//   const { page = 1, limit = 10 } = options;
//   const skip = (page - 1) * limit;

//   // Get user wallet
//   const user = await User.findById(userId).select('digitalWallet');
//   if (!user) {
//     throw new Error('User not found');
//   }


//   // Get transaction history using aggregation
//   const transactionPipeline = [
//     {
//       $match: {
//         user: new mongoose.Types.ObjectId(userId),
//         payment_status: { $in: ['successful', 'refunded'] }
//       }
//     },
//     {
//       $lookup: {
//         from: 'services',
//         localField: 'service',
//         foreignField: '_id',
//         as: 'service'
//       }
//     },
//     {
//       $unwind: { path: '$service', preserveNullAndEmptyArrays: true }
//     },
//     {
//       $project: {
//         gross_amount: 1,
//         createdAt: 1,
//         payment_status: 1,
//         serviceName: '$service.name',
//         tx_ref: 1,
//         paymentType: 1
//       }
//     },
//     { $sort: { createdAt: -1 } },
//     {
//       $facet: {
//         totalCount: [{ $count: 'count' }],
//         transactions: [{ $skip: skip }, { $limit: limit }]
//       }
//     }
//   ];

//   const result = await Transaction.aggregate(transactionPipeline);
//   const totalCount = result[0].totalCount[0]?.count || 0;
//   const transactions = result[0].transactions;

//   return {
//     digitalWallet: user.digitalWallet || 0,
//     transactions,
//     pagination: {
//       totalResults: totalCount,
//       totalPages: Math.ceil(totalCount / limit),
//       currentPage: page,
//       limit
//     }
//   };
// };



const getUserWalletAndTransactions = async (userId, options = {}) => {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  // Get user wallet
  const user = await User.findById(userId).select('digitalWallet');
  if (!user) {
    throw new Error('User not found');
  }

  // 🔥 FIX: handle ObjectId vs string safely
  const matchUser =
    mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

  // Transaction aggregation
  const transactionPipeline = [
    {
      $match: {
        user: matchUser,
        payment_status: { $in: ['successful', 'refunded'] }
      }
    },
    {
      $lookup: {
        from: 'services',
        localField: 'service',
        foreignField: '_id',
        as: 'service'
      }
    },
    {
      $unwind: {
        path: '$service',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        gross_amount: 1,
        createdAt: 1,
        payment_status: 1,
        serviceName: '$service.name',
        tx_ref: 1,
        paymentType: 1
      }
    },
    { $sort: { createdAt: -1 } },
    {
      $facet: {
        totalCount: [{ $count: 'count' }],
        transactions: [
          { $skip: skip },
          { $limit: limit }
        ]
      }
    }
  ];

  const result = await Transaction.aggregate(transactionPipeline);

  // 🔥 FIX: safe empty result handling
  const totalCount = result?.[0]?.totalCount?.[0]?.count || 0;
  const transactions = result?.[0]?.transactions || [];

  return {
    digitalWallet: user.digitalWallet || 0,
    transactions,
    pagination: {
      totalResults: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      limit
    }
  };
};



const creditWalletService = async (hrUserId, options = {}) => {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;
  const employer = await Employer.findOne({ user: hrUserId, isDeleted: false });
  const credit = employer ? employer.creditBalance || 0 : 0;
  const matchState = {
    user: new mongoose.Types.ObjectId(employer._id),
    paymentType: 'credit',
    payment_status: 'successful'
  };
  const transaction = await Promise.all([
    Transaction.aggregate([
      {
        $match: matchState,
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          gross_amount: 1,
          credit: "$gross_amount",
          createdAt: 1
        }
      }
    ]),
    Transaction.countDocuments(matchState)
  ])
  return {
    credit,
    transactions: transaction[0],
    pagination: {
      totalResults: transaction[1],
      totalPages: Math.ceil(transaction[1] / limit),
      currentPage: page,
      limit
    }
  };
}

module.exports = {
  getCountCardsService,
  getMonthlyUserRatio,
  getCategoryServiceCount,
  getPendingStats,
  getHrCardData,
  getHrCreditSpentTrend,
  getPartnerDashboardCount,
  getPartnerBookingTrend,
  getPartnerEarningOverview,
  getUserWalletAndTransactions,
  creditWalletService
};