const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const fileUploadMiddleware = require("../../middlewares/fileUpload");
const UPLOADS_FOLDER = "./public/uploads/SubCategory";
const uploadUsers = fileUploadMiddleware(UPLOADS_FOLDER);
const convertHeicToPng = require('../../middlewares/converter');
const ensureUploadFolderExists = require('../../helpers/fileExists'); 
const parseData = require('../../middlewares/parseData');
const { addSubCategoryController, editSubCategoryController, deleteSubCategoryController, getAllSubCategoryByCategoryController,  } = require("./subCategory.controller");
ensureUploadFolderExists(UPLOADS_FOLDER);

router.post("/add", uploadUsers.single('image'), convertHeicToPng(UPLOADS_FOLDER), auth(['user', 'admin']), parseData(), addSubCategoryController);
router.get("/all-subcategory/:category", getAllSubCategoryByCategoryController);
router.put("/edit/:id", uploadUsers.single('image'), convertHeicToPng(UPLOADS_FOLDER), auth(['user', 'admin']), parseData(), editSubCategoryController);
router.patch("/delete/:id", auth(['admin']), deleteSubCategoryController);


module.exports = router;