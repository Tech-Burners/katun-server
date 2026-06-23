const { default: status } = require("http-status");
const catchAsync = require("../../../helpers/catchAsync");
const response = require("../../../helpers/response");
const { getAboutPageService, updateAboutPageService } = require("./aboutPage.service");
const AboutPage = require("./aboutPage.model");
const { addAuditReport } = require("../../Audit/audit.service");


const updateAboutPage = catchAsync(async (req, res) => {
  const files = req.files || [];
  const BASE_UPLOAD_PATH = "/uploads/web";

  // Build a map of { fieldname -> file } for quick lookup
  // e.g. { icon_0: fileObj, icon_2: fileObj }
  const iconFileMap = {};
  files.forEach((file) => {
    if (file.fieldname.startsWith("icon_")) {
      iconFileMap[file.fieldname] = file;
    }
  });

  // Fetch existing DB document to preserve untouched icons
  const existingPage = await AboutPage.findOne({});

  // Parse ourValues safely
  if (typeof req.body.ourValues === "string") {
    try {
      req.body.ourValues = JSON.parse(req.body.ourValues);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid ourValues JSON format"
      });
    }
  }

  if (Array.isArray(req.body.ourValues)) {
    req.body.ourValues = req.body.ourValues.map((item, index) => {
      const uploadedFile = iconFileMap[`icon_${index}`];

      // Find the matching existing icon by _id or index
      const existingItem = existingPage?.ourValues?.find(
        (e) => String(e._id) === String(item._id)
      ) || existingPage?.ourValues?.[index];

      return {
        ...item,
        icon: uploadedFile
          ? `${BASE_UPLOAD_PATH}/${uploadedFile.filename}`
          : item.icon || existingItem?.icon || null, // ← preserve existing
      };
    });
  }

  const updatedAboutPage = await updateAboutPageService(req.body);
  await addAuditReport({
    action: "Update",
    summary: "About page content updated",
    performedBy: req.User._id,
  });
  return res.status(200).json({
    success: true,
    message: "About page updated successfully",
    data: updatedAboutPage
  });
});


const getAboutPage = catchAsync(async (req, res) => {
  const AboutPageData = await getAboutPageService();
  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "about page",
      message: "about page fetched successfully",
      data: AboutPageData,
    })
  );
});

module.exports = {
  updateAboutPage,
  getAboutPage,
};