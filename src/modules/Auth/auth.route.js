const express = require("express");
const router = express.Router();
const { tokenCheck, auth, resetTokenCheck } = require("../../middlewares/auth");

const userFileUploadMiddleware = require("../../middlewares/fileUpload");
const UPLOADS_FOLDER_USERS = "./public/uploads/users";
const uploadUsers = userFileUploadMiddleware(UPLOADS_FOLDER_USERS);
const convertHeicToPng = require('../../middlewares/converter');
const ensureUploadFolderExists = require('../../helpers/fileExists');
const parseData = require('../../middlewares/parseData');
const { localAuth, userDetailsByID, forgetPassword, resendOTP, resetPassword, changePassword, updateProfile, otpVerification, signUp, partnerProfileController, myDocumentsController, otpVerificationForPartner, createPartnerController, partnerSignUpController, allUserController, deleteAccountController, allPartnerController, updateDocuments } = require("./auth.controller");
ensureUploadFolderExists(UPLOADS_FOLDER_USERS);



router.post("/partner/sign-up", partnerSignUpController);
router.get("/admin/all", allUserController);
router.post("/partner/otp-verify", tokenCheck, otpVerificationForPartner);
router.post(
  "/partner/create",
  tokenCheck,
  uploadUsers.fields([
    { name: "image", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
    { name: "identityProof", maxCount: 1 },
    { name: "businessCertification", maxCount: 1 },
    { name: "bankStatement", maxCount: 1 }
  ]),
  convertHeicToPng(UPLOADS_FOLDER_USERS),
  parseData(),
  createPartnerController
);

router.post("/signin", localAuth);
router.get('/my-profile', auth(['admin', 'hr', 'user', 'partner']), userDetailsByID);
router.get('/my-documents', auth(['admin', 'hr', 'user', 'partner']), myDocumentsController);
router.get('/partner-profile', auth(['partner', 'admin']), partnerProfileController);
router.get('/all-partner', auth(['partner', 'admin']), allPartnerController);
router.post(
  "/sign-up",
  uploadUsers.fields([
    { name: "image", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
    { name: "identityProof", maxCount: 1 },
    { name: "businessCertification", maxCount: 1 },
    { name: "bankStatement", maxCount: 1 }
  ]),
  convertHeicToPng(UPLOADS_FOLDER_USERS),
  parseData(),
  signUp
);


router.post(
  "/update-documents",
  uploadUsers.fields([
    { name: "image", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
    { name: "identityProof", maxCount: 1 },
    { name: "businessCertification", maxCount: 1 },
    { name: "bankStatement", maxCount: 1 }
  ]),
  convertHeicToPng(UPLOADS_FOLDER_USERS),
  auth(['partner']),
  updateDocuments
);


router.post("/forget-password", forgetPassword);
router.post("/verify-otp", tokenCheck, otpVerification);
router.post("/resend-otp", resendOTP);
router.post("/reset-password", resetTokenCheck, resetPassword);
router.patch("/change-password", auth(['partner', 'hr', 'user', 'admin']), changePassword);
router.patch("/delete-account", auth(['partner', 'hr', 'user', 'admin']), deleteAccountController);
router.put('/update-profile', uploadUsers.single('image'),
  convertHeicToPng(UPLOADS_FOLDER_USERS),
    auth(['partner', 'hr', 'user', 'admin']), parseData(),updateProfile);


module.exports = router

