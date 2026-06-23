const { default: status } = require("http-status");
const catchAsync = require("../../../helpers/catchAsync");
const response = require("../../../helpers/response");
const { getPartnerPageService, updatePartnerPageService } = require("./partner.service");
const PartnerPage = require("./partner.model");
const { addAuditReport } = require("../../Audit/audit.service");



const updatePartnerPage = catchAsync(async (req, res) => {
  const files = req.files || [];
  const BASE_UPLOAD_PATH = "/uploads/web";

  // Build a map of { fieldname -> file } for quick lookup
  // e.g. { icon_0: fileObj, icon_2: fileObj }
  const iconFileMap = {};
  files.forEach((file) => {
    if (file.fieldname.startsWith("icon_")) {
      iconFileMap[file.fieldname] = file;
    }
    if (file.fieldname === "bannerImage") {
      req.body.bannerImage = `${BASE_UPLOAD_PATH}/${file.filename}`;
    }
  });

  // Fetch existing DB document to preserve untouched icons
  const existingPage = await PartnerPage.findOne({});

  if (Array.isArray(req.body.howItWorks)) {
    req.body.howItWorks = req.body.howItWorks.map((item, index) => {
      const uploadedFile = iconFileMap[`icon_${index}`];

      // Find the matching existing icon by _id or index
      const existingItem = existingPage?.howItWorks?.find(
        (e) => String(e._id) === String(item._id)
      ) || existingPage?.howItWorks?.[index];

      return {
        ...item,
        icon: uploadedFile
          ? `${BASE_UPLOAD_PATH}/${uploadedFile.filename}`
          : item.icon || existingItem?.icon || null, // ← preserve existing
      };
    });
  }

  // Also preserve bannerImage if not updated
  if (!req.body.bannerImage && existingPage?.bannerImage) {
    req.body.bannerImage = existingPage.bannerImage;
  }

  const updatedPartnerPage = await updatePartnerPageService(req.body);
  await addAuditReport({
    action: "Update",
    summary: "Partner page content updated",
    performedBy: req.User._id,
  });

  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "partner page",
      message: "partner page updated successfully",
      data: updatedPartnerPage,
    })
  );
});


const getPartnerPage = catchAsync(async (req, res) => {
  const PartnerPageData = await getPartnerPageService();
  return res.status(status.OK).json(
    response({
      status: "success",
      statusCode: status.OK,
      type: "partner page",
      message: "partner page fetched successfully",
      data: PartnerPageData,
    })
  );
});

module.exports = {
  updatePartnerPage,
  getPartnerPage,
};