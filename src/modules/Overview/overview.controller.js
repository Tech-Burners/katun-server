const { default: status } = require("http-status");
const catchAsync = require("../../helpers/catchAsync");
const {
  getCountCardsService,
  getMonthlyUserRatio,
  getCategoryServiceCount: getCategoryServiceCountService,
  getPendingStats,
  getHrCardData,
  getHrCreditSpentTrend,
  getPartnerDashboardCount,
  getPartnerBookingTrend,
  getPartnerEarningOverview,
  getUserWalletAndTransactions,
  creditWalletService
} = require('./overview.service');
const response = require("../../helpers/response");

const getCountCards = catchAsync(async (req, res) => {
    const data = await getCountCardsService();
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, message: 'Count cards retrieved successfully', type: 'overview', data: data }));
});



//Get user to  ratio
const userRatio = catchAsync(async (req, res) => {
  let year = Number(req.query.year) || new Date().getFullYear();
  const ratio = await getMonthlyUserRatio(year);

  return res.status(status.OK).json(
    response({
      statusCode: status.OK,
      message: 'user-ratio',
      data: ratio,
      status: 'ok',
    })
  );
});

const getCategoryServiceCount = catchAsync(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const data = await getCategoryServiceCountService(year);

  return res.status(status.OK).json(
    response({
      statusCode: status.OK,
      message: 'category-service-count',
      data,
      status: 'ok'
    })
  );
});

const getPending = catchAsync(async (req, res) => {
  const data = await getPendingStats();

  return res.status(status.OK).json(
    response({
      statusCode: status.OK,
      message: 'pending-stats',
      data,
      status: 'ok'
    })
  );
});

const getHrCard = catchAsync(async (req, res) => {
  const data = await getHrCardData(req.User._id);

  return res.status(status.OK).json(
    response({
      statusCode: status.OK,
      message: 'hr-card-data',
      data,
      status: 'ok'
    })
  );
});



const getHrCreditSpentTrendController = catchAsync(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const data = await getHrCreditSpentTrend(req.User._id, year);

  return res.status(status.OK).json(
    response({
      statusCode: status.OK,
      message: 'hr-credit-spent-trend',
      data,
      status: 'ok'
    })
  );
});

const getPartnerCount = catchAsync(async (req, res) => {
  const data = await getPartnerDashboardCount(req.User._id);

  return res.status(status.OK).json(
    response({
      statusCode: status.OK,
      message: 'partner-count',
      data,
      status: 'ok'
    })
  );
});

const getPartnerBookingTrendController = catchAsync(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const data = await getPartnerBookingTrend(req.User._id, year);

  return res.status(status.OK).json(
    response({
      statusCode: status.OK,
      message: 'partner-booking-trend',
      data,
      status: 'ok'
    })
  );
});

const getPartnerEarningOverviewController = catchAsync(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const data = await getPartnerEarningOverview(req.User._id, year);

  return res.status(status.OK).json(
    response({
      statusCode: status.OK,
      message: 'partner-earning-overview',
      data,
      status: 'ok'
    })
  );
});

const getUserWalletAndTransactionsController = catchAsync(async (req, res) => {
  const userId = req.User._id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const data = await getUserWalletAndTransactions(userId, { page, limit });

  return res.status(status.OK).json(
    response({
      statusCode: status.OK,
      message: 'user-wallet-and-transactions',
      data,
      status: 'ok'
    })
  );
});


const creditWalletController = catchAsync(async (req, res) => {
  const options = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10
  }
  const result = await creditWalletService(req.User._id, options, req.User.role);

  return res.status(status.OK).json(
    response({
      statusCode: status.OK,
      message: 'hr-credit-wallet',
      data: result,
      status: 'ok'
    })
  );
})

module.exports = {
    getCountCards,
    userRatio,
    getCategoryServiceCount,
    getPending,
    getHrCard,
    getHrCreditSpentTrendController,
    getPartnerCount,
    getPartnerBookingTrendController,
    getPartnerEarningOverviewController,
    getUserWalletAndTransactionsController,
    creditWalletController
};
