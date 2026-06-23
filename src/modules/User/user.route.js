const express = require("express");
const router = express.Router();
const { tokenCheck, auth } = require("../../middlewares/auth");



const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const UPLOADS_FOLDER_USERS = "./public/uploads/users";
const uploadUsers = userFileUploadMiddleware(UPLOADS_FOLDER_USERS);
const convertHeicToPng = require('../../middlewares/converter');
const ensureUploadFolderExists = require('../../helpers/fileExists');
const parseData = require('../../middlewares/parseData');
const { suspendUserController, activeUserController, addFlagController, addNoteController, addCreditController,checkServiceAvailability, fcmTokenController, deleteFcmTokenController } = require("./user.controller");
ensureUploadFolderExists(UPLOADS_FOLDER_USERS);

router.patch("/ban/:id", suspendUserController)
router.patch("/active/:id", activeUserController) 
router.patch("/flag/:id", addFlagController) 
router.patch("/note/:id", addNoteController) 
router.patch("/add-credit/:id", addCreditController) 
router.get("/check-service-availability",auth(['partner']), checkServiceAvailability)
router.post("/add-fcmToken", auth(['user', 'partner']), fcmTokenController);
router.delete("/delete-fcmToken", auth(['user', 'partner']), deleteFcmTokenController);

module.exports = router;

