const express = require("express");
const { addServiceController, editServiceController, deleteServiceController, getAllServiceController, aServiceDetailsController, disableServiceController, activeServiceController, getPartnerAllServiceController, popularServiceController, allServiceController } = require("./service.controller");
const router = express.Router();

const fileUploadMiddleware = require("../../middlewares/fileUpload");
const UPLOADS_FOLDER = "./public/uploads/service";
const upload = fileUploadMiddleware(UPLOADS_FOLDER);
const convertHeicToPng = require('../../middlewares/converter');
const ensureUploadFolderExists = require('../../helpers/fileExists');
const parseData = require('../../middlewares/parseData');
const { auth } = require("../../middlewares/auth");
ensureUploadFolderExists(UPLOADS_FOLDER);


router.post("/add", upload.single('image'), convertHeicToPng(UPLOADS_FOLDER), parseData(), auth(['partner', 'admin']), addServiceController);
router.put("/edit/:id", upload.single('image'), convertHeicToPng(UPLOADS_FOLDER), parseData(), auth(['partner', 'admin']), editServiceController);
router.patch("/delete/:id", deleteServiceController);
router.patch("/disable/:id", disableServiceController);
router.patch("/active/:id", activeServiceController);
router.get("/admin/all", auth(['admin']), getAllServiceController);
router.get("/partner/all", auth(['partner']), getPartnerAllServiceController);
router.get("/popular", auth(["user"], { optional: true }), popularServiceController);
router.get("/all", auth(["user"], { optional: true }), allServiceController);
router.get('/details/:id', auth(['partner','user', 'admin'], { optional: true }), aServiceDetailsController);

module.exports = router;

