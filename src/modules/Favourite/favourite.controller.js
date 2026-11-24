const { default: status } = require("http-status");
const { favouriteUnfavouriteService, myFavouriteService } = require("./favourite.service");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");


const favouriteUnfavouriteController = catchAsync(async (req, res) => {
  req.body.user = req.User._id;
  const result = await favouriteUnfavouriteService(req.body)
  return res.status(status.CREATED).json(response({ status: 'Success', statusCode: status.CREATED, type: 'favourite', message: 'favourite-added', data: result }));
});


const myFavouriteController = catchAsync(async (req, res) => {
  const queryLat = req.query?.latitude ?? req.query?.lat;
  const queryLng = req.query?.longitude ?? req.query?.lng ?? req.query?.lon ?? req.query?.long;
  const bodyLat = req.body?.latitude ?? req.body?.lat;
  const bodyLng = req.body?.longitude ?? req.body?.lng ?? req.body?.lon ?? req.body?.long;

  let lat = queryLat !== undefined && queryLat !== null && queryLat !== "" ? queryLat : bodyLat;
  let lng = queryLng !== undefined && queryLng !== null && queryLng !== "" ? queryLng : bodyLng;

  const locationOptions = (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng)))
    ? { lat: Number(lat), lng: Number(lng) }
    : null;

  const result = await myFavouriteService(req.User._id, locationOptions);
  return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'favourite', message: 'favourite-fetched', data: result }));
});

module.exports = { favouriteUnfavouriteController, myFavouriteController };