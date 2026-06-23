const { default: status } = require("http-status");
const response = require("../../helpers/response");
const catchAsync = require("../../helpers/catchAsync");
const { pendingPartnerForApprovalService, detailsForAdminService,
  allPartnerService, suspendPartnerService, activePartnerService,
  giveFlagService, giveNoteService, 
  rejectProviderService,
  approvePartnerService,
  partnerFeedbackService,
  aPartnerDetailsService,
  partnerDashboardService} = require("./partner.service");


const pendingPartnerForApproval = catchAsync(async (req, res) => {
  const options = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
    search: req.query.search || ""
  }
  const result = await pendingPartnerForApprovalService(options);
  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "partner",
      message: "pending partner fetched successfully",
      data: result
    })
  );
});


const suspendPartnerController = catchAsync(async (req, res) => {
  const result = await suspendPartnerService(req.params.id, req.User._id);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Partner", message: "Partner suspended successfully", data: {name : result.businessName}
  }));
})

const activePartnerController = catchAsync(async (req, res) => {
  const result = await activePartnerService(req.params.id, req.User._id);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Partner", message: "Partner activated successfully", data: {name : result.businessName}
  }));
})

const approvePartnerController = catchAsync(async (req, res) => {
  const result = await approvePartnerService(req.params.id, req.User._id);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Partner", message: "Partner approved successfully", data: {name : result.businessName}
  }));
})


const giveFlagController = catchAsync(async (req, res) => {
  await giveFlagService(req.params.id, req.User._id);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Partner", message: "one flag added"
  }));
})


const giveNoteController = catchAsync(async (req, res) => {
  req.body.performedBy = req.User._id;
  await giveNoteService(req.params.id, req.body);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Partner", message: "note added"
  }));
})


const rejectProviderController = catchAsync(async (req, res) => {
  req.body.performedBy = req.User._id;
  await rejectProviderService(req.params.id, req.body);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Partner", message: "Partner rejected successfully"
  }));
})


const partnerFeedbackController = catchAsync(async (req, res) => {
  const feedback = await partnerFeedbackService(req.params.partnerId,req.body);
  return res.status(status.CREATED).json(response({ status: "success", statusCode: status.CREATED, type: "feedback", message:"feedback-added", data: feedback }));
});


const aPartnerDetailsController = catchAsync(async (req, res) => {
  const result = await aPartnerDetailsService(
    req.params.id,
    req.User?._id || null
  );

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "partner",
      message: "partner details fetched successfully",
      data: result,
    })
  );
});

const allPartnerController = catchAsync(async (req, res) => {
  const options = {
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 10,
    search: req.query.search || "",
    isBan: req.query.isBan
  }
  const result = await allPartnerService(options);
  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "partner",
      message: "all partner fetched successfully",
      data: result
    })
  );
});



const detailsForAdminController = catchAsync(async (req, res) => {
  const result = await detailsForAdminService(req.params.id);
  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "partner",
      message: "partner details fetched successfully",
      data: result
    })
  );
});



const partnerDashboardController = catchAsync(async (req, res) => {
  const userId = req.User._id;
  const year = Number(req.query.year) || new Date().getFullYear();
  const result = await partnerDashboardService(userId, year);
  
  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "partner-dashboard",
      message: "Partner dashboard data fetched successfully",
      data: result
    })
  );
});



module.exports = {
  pendingPartnerForApproval,
  detailsForAdminController,
  allPartnerController,
  suspendPartnerController,
  activePartnerController,
  giveFlagController,
  giveNoteController,
  rejectProviderController,
  approvePartnerController,
  partnerFeedbackController,
  aPartnerDetailsController,
  partnerDashboardController
};