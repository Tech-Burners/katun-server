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
  partnerDashboardService,
  bulkSuspendPartnerService,
  bulkActivePartnerService,
  bulkApprovePartnerService,
  bulkGiveFlagService,
  bulkGiveNoteService,
  bulkRejectProviderService} = require("./partner.service");


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

const bulkSuspendPartnerController = catchAsync(async (req, res) => {
  const { partnerIds } = req.body;

  if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
    return res.status(status.BAD_REQUEST).json(
      response({
        status: "fail",
        statusCode: status.BAD_REQUEST,
        message: "Please provide partnerIds.",
      })
    );
  }

  const result = await bulkSuspendPartnerService(
    partnerIds,
    req.User._id
  );

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "Partner",
      message: `${result.modifiedCount} partner(s) suspended successfully.`,
      data: result,
    })
  );
});

const activePartnerController = catchAsync(async (req, res) => {
  const result = await activePartnerService(req.params.id, req.User._id);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Partner", message: "Partner activated successfully", data: {name : result.businessName}
  }));
})


const bulkActivePartnerController = catchAsync(async (req, res) => {
  const { partnerIds } = req.body;

  if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
    return res.status(status.BAD_REQUEST).json(
      response({
        status: "fail",
        statusCode: status.BAD_REQUEST,
        message: "Please provide partnerIds.",
      })
    );
  }

  const result = await bulkActivePartnerService(
    partnerIds,
    req.User._id
  );

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "Partner",
      message: `${result.modifiedCount} partner(s) activated successfully.`,
      data: result,
    })
  );
});


const approvePartnerController = catchAsync(async (req, res) => {
  const result = await approvePartnerService(req.params.id, req.User._id);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Partner", message: "Partner approved successfully", data: {name : result.businessName}
  }));
})

//
const bulkApprovePartnerController = catchAsync(async (req, res) => {
  const { partnerIds } = req.body;

  if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
    return res.status(status.BAD_REQUEST).json(
      response({
        status: "fail",
        statusCode: status.BAD_REQUEST,
        message: "Please provide partnerIds.",
      })
    );
  }

  const result = await bulkApprovePartnerService(
    partnerIds,
    req.User._id
  );

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "Partner",
      message: `${result.modifiedCount} partner(s) approved successfully.`,
      data: result,
    })
  );
});


const giveFlagController = catchAsync(async (req, res) => {
  await giveFlagService(req.params.id, req.User._id);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Partner", message: "one flag added"
  }));
})
const bulkGiveFlagController = catchAsync(async (req, res) => {
  const { partnerIds } = req.body;

  if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
    return res.status(status.BAD_REQUEST).json(
      response({
        status: "fail",
        statusCode: status.BAD_REQUEST,
        message: "Please provide partnerIds.",
      })
    );
  }

  const result = await bulkGiveFlagService(
    partnerIds,
    req.User._id
  );

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "Partner",
      message: `${result.modifiedCount} partner(s) flagged successfully.`,
      data: result,
    })
  );
});


const giveNoteController = catchAsync(async (req, res) => {
  req.body.performedBy = req.User._id;
  await giveNoteService(req.params.id, req.body);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Partner", message: "note added"
  }));
})


const bulkGiveNoteController = catchAsync(async (req, res) => {
  const { partnerIds, note } = req.body;

  if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
    return res.status(status.BAD_REQUEST).json(
      response({
        status: "fail",
        statusCode: status.BAD_REQUEST,
        message: "Please provide partnerIds.",
      })
    );
  }

  if (!note?.trim()) {
    return res.status(status.BAD_REQUEST).json(
      response({
        status: "fail",
        statusCode: status.BAD_REQUEST,
        message: "Note is required.",
      })
    );
  }

  const result = await bulkGiveNoteService(
    partnerIds,
    note,
    req.User._id
  );

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "Partner",
      message: `${result.modifiedCount} partner(s) updated successfully.`,
      data: result,
    })
  );
});


const rejectProviderController = catchAsync(async (req, res) => {
  req.body.performedBy = req.User._id;
  await rejectProviderService(req.params.id, req.body);
  return res.status(status.OK).json(response({
    status: 'success', statusCode: status.OK, type: "Partner", message: "Partner rejected successfully"
  }));
})


const bulkRejectProviderController = catchAsync(async (req, res) => {
  const { partnerIds, reason } = req.body;

  if (!Array.isArray(partnerIds) || partnerIds.length === 0) {
    return res.status(status.BAD_REQUEST).json(
      response({
        status: "fail",
        statusCode: status.BAD_REQUEST,
        message: "Please provide partnerIds.",
      })
    );
  }

  if (!reason?.trim()) {
    return res.status(status.BAD_REQUEST).json(
      response({
        status: "fail",
        statusCode: status.BAD_REQUEST,
        message: "Reason is required.",
      })
    );
  }

  const result = await bulkRejectProviderService(partnerIds, {
    reason,
    performedBy: req.User._id,
  });

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "Partner",
      message: `${result.deletedCount} partner(s) rejected successfully.`,
      data: result,
    })
  );
});


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
  partnerDashboardController,
  bulkSuspendPartnerController,
  bulkActivePartnerController,
  bulkApprovePartnerController,
  bulkGiveFlagController,
  bulkGiveNoteController,
  bulkRejectProviderController
};