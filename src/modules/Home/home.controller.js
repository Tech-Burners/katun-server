const { default: status } = require("http-status");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");
const { pendingBookingService, nearestService, promoService, allNearestService } = require("./home.service");
const ApiError = require("../../helpers/ApiError");


const homeController = catchAsync(async (req, res) => {
    const upcomingBooking = await pendingBookingService(req.User. _id);
  const { longitude, latitude } = req.body;

  if (!longitude || !latitude) {
    throw new ApiError(status.BAD_REQUEST, "Longitude and latitude are required");
  }

  const nearest = await nearestService(longitude, latitude);
  const promo = await promoService();
    return res.status(status.OK).json(response(
        {
            status: 'Success', statusCode: status.OK,
            type: 'home', message: 'home',
            data: { upcomingBooking, nearest , promo },
        }));
})


const allNerestController = catchAsync(async (req, res) => {
  const { longitude, latitude } = req.body;

  if (!longitude || !latitude) {
    throw new ApiError(status.BAD_REQUEST, "Longitude and latitude are required");
  }

  const options = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
    search: req.query.search || ""  
  };

  const nearest = await allNearestService(longitude, latitude, options);

  return res.status(status.OK).json(
    response({
      status: "Success",
      statusCode: status.OK,
      type: "home",
      message: "home",
      data: { nearest },
    })
  );
});


module.exports = {
    homeController,
    allNerestController
}