const express = require("express");
const { addBranchController, deleteBranchController, getBranchController, updateBranchController } = require("./branch.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();

router.post("/add", auth(['hr' ,'sub_hr_admin']), addBranchController);
router.get("/all", auth(['hr' ,'sub_hr_admin']), getBranchController);
router.put("/edit/:id", auth(['hr','sub_hr_admin']), updateBranchController);
router.patch("/delete/:id", auth(['hr','sub_hr_admin']), deleteBranchController);

module.exports = router;