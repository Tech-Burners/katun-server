const catchAsync = require("../../helpers/catchAsync");
const { getPendingPayouts, getPendingPayoutListService, updatePayoutFrequency, completePayoutService, holdPayoutService, getMyFrequencyService } = require("./payout.service");


const getPendingPayoutController = catchAsync(async (req, res) => {
  const data = await getPendingPayoutListService(req.query);
//   const data = await getPendingPayouts(req.query);

  return res.status(200).json({
    success: true,
    message: "Pending payouts fetched successfully",
    data,
  });
});


const getMyFrequencyController = catchAsync(async (req, res) => {
  const data = await getMyFrequencyService(req.User._id);

  return res.status(200).json({
    success: true,
    message: "Payout frequency fetched successfully",
    data,
  });
});

const updatePayoutFrequencyController = catchAsync(async (req, res) => {
  const { frequency } = req.body;
  const data = await updatePayoutFrequency(req.User._id, frequency);
  return res.status(200).json({
    success: true,
    message: "Payout frequency updated successfully",
    data,
  });
});


const holdPayoutController = catchAsync(async (req, res) => {
  const data = await holdPayoutService(req.params.cycleId);

  return res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Payout placed on hold successfully",
    data,
  });
});

const completePayoutController = catchAsync(async (req, res) => {
  const data = await completePayoutService(
    req.params.cycleId,
    req.User._id
  );

  return res.status(200).json({
    success: true,
    statusCode: 200,
    message: "Payout completed successfully",
    data,
  });
});


module.exports = {
  getPendingPayoutController,
  updatePayoutFrequencyController,
  holdPayoutController,
  completePayoutController,
  getMyFrequencyController
};