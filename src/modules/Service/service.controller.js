const { default: status } = require("http-status");
const { deleteServiceService, editServiceService, addServiceService, getAllServiceService, aServiceDetailsService, disableServiceService, activeEmployerService, getPartnerAllServiceService, popularService, allServiceService, nearestPopularService } = require("./service.service");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");
const userModel = require("../User/user.model");

const extractLocationCoordinates = async (req) => {
  const queryLat = req.query?.latitude ?? req.query?.lat;
  const queryLng = req.query?.longitude ?? req.query?.lng ?? req.query?.lon ?? req.query?.long;
  const bodyLat = req.body?.latitude ?? req.body?.lat;
  const bodyLng = req.body?.longitude ?? req.body?.lng ?? req.body?.lon ?? req.body?.long;

  let lat = queryLat !== undefined && queryLat !== null && queryLat !== "" ? queryLat : bodyLat;
  let lng = queryLng !== undefined && queryLng !== null && queryLng !== "" ? queryLng : bodyLng;

  if (
    lat !== undefined && lat !== null && lat !== "" && lat !== "null" && lat !== "undefined" &&
    lng !== undefined && lng !== null && lng !== "" && lng !== "null" && lng !== "undefined" &&
    !isNaN(Number(lat)) && !isNaN(Number(lng))
  ) {
    return { lat: Number(lat), lng: Number(lng) };
  }

  // Fallback to logged-in user profile location if dynamic location is not provided
  if (req.User) {
    if (req.User.location?.coordinates?.length === 2) {
      const [uLng, uLat] = req.User.location.coordinates;
      if (uLng != null && uLat != null && !isNaN(Number(uLng)) && !isNaN(Number(uLat))) {
        return { lat: Number(uLat), lng: Number(uLng) };
      }
    }
    const userDoc = await userModel.findById(req.User._id).select("location");
    if (userDoc?.location?.coordinates?.length === 2) {
      const [uLng, uLat] = userDoc.location.coordinates;
      if (uLng != null && uLat != null && !isNaN(Number(uLng)) && !isNaN(Number(uLat))) {
        return { lat: Number(uLat), lng: Number(uLng) };
      }
    }
  }

  return null;
};


const addServiceController = catchAsync(async (req, res) => {
    if (req.file) {
        req.body.image = `/uploads/service/${req.file.filename}`
    }
    req.body.user = req.User._id;
    const newService = await addServiceService(req.body);
    if (newService) return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Service", message: "Service added successfully", data: newService, }));
    else return res.status(status.BAD_REQUEST).json(response({ status: 'error', statusCode: status.BAD_REQUEST, type: "Service", message: "Service add failed" }));
})


const editServiceController = catchAsync(async (req, res) => {
    if (req.file) {
        req.body.image = `/uploads/service/${req.file.filename}`
    }
    const result = await editServiceService(req.params.id, req.body);
    if (result) return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Service", message: "Service edited successfully", data: result, }));
    else return res.status(status.BAD_REQUEST).json(response({ status: 'error', statusCode: status.BAD_REQUEST, type: "Service", message: "Service edit failed" }));
})


const deleteServiceController = catchAsync(async (req, res) => {
    const result = await deleteServiceService(req.params.id);
    if (result) return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Service", message: "Service deleted successfully" }));
    else return res.status(status.BAD_REQUEST).json(response({ status: 'error', statusCode: status.BAD_REQUEST, type: "Service", message: "Service delete failed" }));
})


const disableServiceController = catchAsync(async (req, res) => {
    const result = await disableServiceService(req.params.id);
    if (result) return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Service", message: "Service disabled successfully" }));
    else return res.status(status.BAD_REQUEST).json(response({ status: 'error', statusCode: status.BAD_REQUEST, type: "Service", message: "Service disable failed" }));
})

const activeServiceController = catchAsync(async (req, res) => {
    const result = await activeEmployerService(req.params.id);
    if (result) return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Service", message: "Service enabled successfully" }));
    else return res.status(status.BAD_REQUEST).json(response({ status: 'error', statusCode: status.BAD_REQUEST, type: "Service", message: "Service enable failed" }));
})

const getAllServiceController = catchAsync(async (req, res) => {

    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search || "",
        categoryId: req.query.categoryId,
        subCategoryId: req.query.subCategoryId,
        status: req.query.status
    };

    const result = await getAllServiceService(options);

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            type: "Service",
            message: "Service fetched successfully",
            data: result,
        })
    );
});

const popularServiceController = catchAsync(async (req, res) => {
  const loc = await extractLocationCoordinates(req);

  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
    lng: loc ? loc.lng : null,
    lat: loc ? loc.lat : null,
    search: req.query.search || "",  
  };

  const loginUserId = req.User?._id || null;

  const result = await popularService(loginUserId, option);

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "Service",
      message: "popular Service fetched successfully",
      data: result,
    })
  );
});



const nearestPopularServiceController = catchAsync(async (req, res) => {
  const loc = await extractLocationCoordinates(req);
  const hasLocation = loc !== null;

  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
    lat: loc ? loc.lat : null,
    lng: loc ? loc.lng : null,
    search: req.query.search || "",
    radius: req.query.radius ? Number(req.query.radius) : undefined,
    maxDistance: req.query.maxDistance ? Number(req.query.maxDistance) : undefined,
    category: req.query.category,
    userId: req.User?._id || null,
  };

  const result = await nearestPopularService(option);

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "Service",
      message: hasLocation
        ? "Nearest popular service fetched successfully"
        : "Popular service fetched successfully",
      data: result,
    })
  );
});
 


const allServiceController = catchAsync(async (req, res) => {
  const loc = await extractLocationCoordinates(req);

  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,

    categoryId: req.query.categoryId,
    subCategoryId: req.query.subCategoryId,
    rating: req.query.rating,
    search: req.query.search,

    lat: loc ? loc.lat : null,
    lng: loc ? loc.lng : null,
    radius: req.query.radius ? Number(req.query.radius) : undefined,

    userId: req.User?._id || null,
  };

  const result = await allServiceService(option);

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "Service",
      message: "Service fetched successfully",
      data: result,
    })
  );
});

const getPartnerAllServiceController = catchAsync(async (req, res) => {

    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search || "",
        categoryId: req.query.categoryId,
        subCategoryId: req.query.subCategoryId,
        status: req.query.status
    };

    const result = await getPartnerAllServiceService(
        req.User._id,
        options
    );

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            type: "Service",
            message: "Service fetched successfully",
            data: result,
        })
    );
});

const aServiceDetailsController = catchAsync(async (req, res) => {
    const userId = req.User?._id || null;
    const loc = await extractLocationCoordinates(req);

    const result = await aServiceDetailsService(req.params.id, userId, loc);

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            type: "Service",
            message: "Service details successfully",
            data: result,
        })
    );
});


module.exports = {
    addServiceController, editServiceController, deleteServiceController,
    getAllServiceController, 
    aServiceDetailsController, disableServiceController, activeServiceController,
    getPartnerAllServiceController,
    popularServiceController,
    nearestPopularServiceController,
    allServiceController
}