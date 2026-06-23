const express = require("express");
const { addEmployeeController,
     getAllEmployeeController, getEmployeeController,
      editEmployeeController, deleteEmployeeController, 
      suspendEmployeeController, activeEmployeeController, 
      allocateCreditController, 
    getCompanyAllEmployeeController, 
    flagEmployeeController,
    allocateCreditEmployeeController,
    addNoteController} = require("./employee.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();


router.post("/add", auth(['hr','sub_hr_admin','admin']), addEmployeeController);
router.get("/admin/all", getAllEmployeeController);
router.get("/company/all",auth(['hr','sub_hr_admin']), getCompanyAllEmployeeController);
router.get("/details/:id", getEmployeeController);
router.put("/edit/:id", auth(['hr',,'sub_hr_admin','admin']), editEmployeeController);
router.patch("/flag/:id", auth(['hr','sub_hr_admin', 'admin']), flagEmployeeController);
router.patch("/allocate-credit/:id", auth(['hr','sub_hr_admin','admin']), allocateCreditEmployeeController);
router.patch("/suspend/:id", auth(['hr','sub_hr_admin','admin']), suspendEmployeeController);
router.patch("/note/:id", auth(['hr','sub_hr_admin','admin']), addNoteController);
router.patch("/active/:id", auth(['hr','sub_hr_admin','admin']), activeEmployeeController);
router.patch("/delete/:id", auth(['hr','sub_hr_admin','admin']), deleteEmployeeController);

module.exports = router;