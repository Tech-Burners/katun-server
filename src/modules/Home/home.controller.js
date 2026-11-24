const { default: status } = require("http-status");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");
const { pendingBookingService, nearestService, promoService, allNearestService } = require("./home.service");
const ApiError = require("../../helpers/ApiError");


// const homeController = catchAsync(async (req, res) => {
//     const upcomingBooking = await pendingBookingService(req.User. _id);
//   const { longitude, latitude } = req.body;

//   if (!longitude || !latitude) {
//     throw new ApiError(status.BAD_REQUEST, "Longitude and latitude are required");
//   }

//   const nearest = await nearestService(longitude, latitude);
//   const promo = await promoService();
//     return res.status(status.OK).json(response(
//         {
//             status: 'Success', statusCode: status.OK,
//             type: 'home', message: 'home',
//             data: { upcomingBooking, nearest , promo },
//         }));
// })


const homeController = catchAsync(async (req, res) => {
  let upcomingBooking = null;

  // Only logged-in user has upcoming booking
  if (req.User) {
    upcomingBooking = await pendingBookingService(req.User._id);
  }

  // 1. Dynamic location from query or body
  const queryLat = req.query?.latitude ?? req.query?.lat;
  const queryLng = req.query?.longitude ?? req.query?.lng ?? req.query?.lon ?? req.query?.long;
  const bodyLat = req.body?.latitude ?? req.body?.lat;
  const bodyLng = req.body?.longitude ?? req.body?.lng ?? req.body?.lon ?? req.body?.long;

  let lat = queryLat !== undefined && queryLat !== null && queryLat !== "" ? queryLat : bodyLat;
  let lng = queryLng !== undefined && queryLng !== null && queryLng !== "" ? queryLng : bodyLng;

  // 2. Fallback to logged-in user's profile location if dynamic location is not provided
  if ((lat == null || lng == null || lat === "" || lng === "") && req.User?.location?.coordinates?.length === 2) {
    const [uLng, uLat] = req.User.location.coordinates;
    if (uLng != null && uLat != null && !isNaN(Number(uLng)) && !isNaN(Number(uLat))) {
      lng = uLng;
      lat = uLat;
    }
  }

  const hasLocation =
    lat != null &&
    lng != null &&
    lat !== "" &&
    lng !== "" &&
    !isNaN(Number(lat)) &&
    !isNaN(Number(lng));

  let nearest;

  if (hasLocation) {
    // Show services sorted by distance/relevance with distance calculated
    nearest = await nearestService(Number(lng), Number(lat));
  } else {
    // Optional location: show all active services without error
    nearest = await nearestService();
  }

  const promo = await promoService();

  return res.status(status.OK).json(
    response({
      status: "Success",
      statusCode: status.OK,
      type: "home",
      message: "home",
      data: {
        upcomingBooking,
        nearest,
        promo
      }
    })
  );
});



// const allNerestController = catchAsync(async (req, res) => {
//   const { longitude, latitude } = req.body;

//   if (!longitude || !latitude) {
//     throw new ApiError(status.BAD_REQUEST, "Longitude and latitude are required");
//   }

//   const options = {
//     page: Number(req.query.page) || 1,
//     limit: Number(req.query.limit) || 10,
//     search: req.query.search || ""  
//   };

//   const nearest = await allNearestService(longitude, latitude, options);

//   return res.status(status.OK).json(
//     response({
//       status: "Success",
//       statusCode: status.OK,
//       type: "home",
//       message: "home",
//       data: { nearest },
//     })
//   );
// });

const allNerestController = catchAsync(async (req, res) => {
  // 1. Dynamic location from query or body
  const queryLat = req.query?.latitude ?? req.query?.lat;
  const queryLng = req.query?.longitude ?? req.query?.lng ?? req.query?.lon ?? req.query?.long;
  const bodyLat = req.body?.latitude ?? req.body?.lat;
  const bodyLng = req.body?.longitude ?? req.body?.lng ?? req.body?.lon ?? req.body?.long;

  let lat = queryLat !== undefined && queryLat !== null && queryLat !== "" ? queryLat : bodyLat;
  let lng = queryLng !== undefined && queryLng !== null && queryLng !== "" ? queryLng : bodyLng;

  // 2. Fallback to logged-in user profile location
  if ((lat == null || lng == null || lat === "" || lng === "") && req.User?.location?.coordinates?.length === 2) {
    const [uLng, uLat] = req.User.location.coordinates;
    if (uLng != null && uLat != null && !isNaN(Number(uLng)) && !isNaN(Number(uLat))) {
      lng = uLng;
      lat = uLat;
    }
  }

  const hasLocation =
    lat != null &&
    lng != null &&
    lat !== "" &&
    lng !== "" &&
    !isNaN(Number(lat)) &&
    !isNaN(Number(lng));

  const options = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
    search: req.query.search || "",
  };

  const nearest = await allNearestService(
    hasLocation ? Number(lng) : null,
    hasLocation ? Number(lat) : null,
    options,
    req.User
  );

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