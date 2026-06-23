
const { default: status } = require("http-status");
const catchAsync = require("../../../helpers/catchAsync");
const { updateHomePageService, getHomePageService } = require("./homepage.service");
const response = require("../../../helpers/response");
const { addAuditReport } = require("../../Audit/audit.service");



const updateHomePage = catchAsync(async (req, res) => {
  const body = req.body;


  if (req.files?.heroImage?.length) {
    body.heroImage = `/uploads/web/${req.files.heroImage[0].filename}`;
  }

  if (req.files?.serviceIcon?.length) {
    body.serviceIcon = `/uploads/web/${req.files.serviceIcon[0].filename}`;
  }

  const updatedHomePage = await updateHomePageService(body);
  await addAuditReport({
    action: "Update",
    summary: "Home page content updated",
    performedBy: req.User._id,
  });
  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "home page",
      message: "home page updated successfully",
      data: updatedHomePage,
    })
  );
});



const getHomePage = catchAsync(async (req, res) => {
  const homePageData = await getHomePageService();
  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "home page",
      message: "home page fetched successfully",
      data: homePageData,
    })
  );
});

module.exports = {
  updateHomePage,
  getHomePage,
};