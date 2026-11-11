const express = require("express");
const {
    addPromoController,
    getPromoController,
    editPromoController,
    deletePromoController,
    getPartnerPromoController,
    getAdminPromoController,
    getCouponsByPartnerController,
} = require("./promo.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();

const fileUploadMiddleware = require("../../middlewares/fileUpload");
const UPLOADS_FOLDER = "./public/uploads/promo";
const uploadUsers = fileUploadMiddleware(UPLOADS_FOLDER);
const convertHeicToPng = require('../../middlewares/converter');
const ensureUploadFolderExists = require('../../helpers/fileExists');
const parseData = require('../../middlewares/parseData');
ensureUploadFolderExists(UPLOADS_FOLDER);

router.get("/partner/all", auth(['partner']), getPartnerPromoController);
router.get("/partner/:partnerId", auth(['user', 'partner', 'admin', 'sub_admin'], { optional: true }), getCouponsByPartnerController);
router.get("/coupons/:partnerId", auth(['user', 'partner', 'admin', 'sub_admin'], { optional: true }), getCouponsByPartnerController);
router.get("/admin/all", getAdminPromoController);
router.post("/add", uploadUsers.single('image'), convertHeicToPng(UPLOADS_FOLDER), auth(['partner', 'admin', 'sub_admin']), parseData(), addPromoController);
router.put('/edit/:id', uploadUsers.single('image'), convertHeicToPng(UPLOADS_FOLDER), auth(['partner', 'admin', 'sub_admin']), parseData(), editPromoController);
router.delete('/delete/:id', deletePromoController);

module.exports = router;