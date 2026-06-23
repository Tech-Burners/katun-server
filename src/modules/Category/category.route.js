const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const { addCategoryController, editCategoryController, deleteCategoryController, getAllCategoryController } = require("./category.controller");

const fileUploadMiddleware = require("../../middlewares/fileUpload");
const UPLOADS_FOLDER = "./public/uploads/category";
const uploadUsers = fileUploadMiddleware(UPLOADS_FOLDER);
const convertHeicToPng = require('../../middlewares/converter');
const ensureUploadFolderExists = require('../../helpers/fileExists');
const parseData = require('../../middlewares/parseData');
ensureUploadFolderExists(UPLOADS_FOLDER);

router.post("/add", uploadUsers.single('image'), convertHeicToPng(UPLOADS_FOLDER), auth(['user', 'admin']), parseData(), addCategoryController);
router.get("/all", getAllCategoryController);
router.put("/edit/:id", uploadUsers.single('image'), convertHeicToPng(UPLOADS_FOLDER), auth(['user', 'admin']), parseData(), editCategoryController);
router.patch("/delete/:id", auth(['admin']), deleteCategoryController);


module.exports = router;