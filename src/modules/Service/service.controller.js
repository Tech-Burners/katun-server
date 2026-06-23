const { default: status } = require("http-status");
const { deleteServiceService, editServiceService, addServiceService, getAllServiceService, aServiceDetailsService, disableServiceService, activeEmployerService, getPartnerAllServiceService, popularService, allServiceService } = require("./service.service");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");


const addServiceController = catchAsync(async (req, res) => {
    console.log("HIIIIIIIIIIIIIIIIIII")
    console.log(req.body)
    console.log(req.body.data)
    if (req.file) {
        req.body.image = `/uploads/service/${req.file.filename}`
    }
    req.body.user = req.User._id;
    console.log("hi:::::",req.body)
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
  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
    lng: req.query.lng,
    lat: req.query.lat,
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

const allServiceController = catchAsync(async (req, res) => {
  const option = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,

    categoryId: req.query.categoryId,
    subCategoryId: req.query.subCategoryId,
    rating: req.query.rating,
    search: req.query.search,

    lat: req.query.lat,
    lng: req.query.lng,

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

    const result = await aServiceDetailsService(req.params.id, userId);

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
    allServiceController
}