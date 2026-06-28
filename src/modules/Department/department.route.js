const express = require("express");
const { auth } = require("../../middlewares/auth");
const { addDepartmentController , getDepartmentController, updateDepartmentController, deleteDepartmentController} = require("./department.controller");
const router = express.Router();

router.post("/add", auth(['hr','sub_hr_admin']), addDepartmentController);
router.get("/all", auth(['hr','sub_hr_admin', 'admin', 'sub_admin']), getDepartmentController);
router.put("/edit/:id", auth(['hr','sub_hr_admin']), updateDepartmentController);
router.patch("/delete/:id", auth(['hr','sub_hr_admin','admin', 'sub_admin']), deleteDepartmentController);

module.exports = router;