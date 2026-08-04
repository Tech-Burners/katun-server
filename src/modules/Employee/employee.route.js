const express = require("express");
const { addEmployeeController,
     getAllEmployeeController, getEmployeeController,
      editEmployeeController, deleteEmployeeController, 
      suspendEmployeeController, activeEmployeeController, 
      allocateCreditController, 
    getCompanyAllEmployeeController, 
    flagEmployeeController,
    allocateCreditEmployeeController,
    addNoteController,
    bulkFlagEmployeeController,
    bulkSuspendEmployeeController,
    bulkActiveEmployeeController,
    bulkAddNoteController,
    bulkAllocateCreditEmployeeController} = require("./employee.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();


router.post("/add", auth(['hr','sub_hr_admin','admin','sub_admin']), addEmployeeController);
router.get("/admin/all",auth(['admin','sub_admin','hr','sub_hr_admin']), getAllEmployeeController);
router.get("/company/all",auth(['hr','sub_hr_admin']), getCompanyAllEmployeeController);
router.patch(
    "/bulk-flag",
    auth(['hr','sub_hr_admin', 'admin', 'sub_admin']),
    bulkFlagEmployeeController
);
router.patch(
    "/bulk-suspend",
    auth(['hr','sub_hr_admin', 'admin', 'sub_admin']),
    bulkSuspendEmployeeController
);

router.patch(
    "/bulk-active",
    auth(['hr','sub_hr_admin', 'admin', 'sub_admin']),
    bulkActiveEmployeeController
);

router.patch(
    "/bulk-note",
    auth(['admin','sub_admin', 'hr','sub_hr_admin']),
    bulkAddNoteController
);

router.patch(
    "/bulk-allocate-credit",
    auth(['admin','sub_admin', 'hr','sub_hr_admin']),
    bulkAllocateCreditEmployeeController
);

router.get("/details/:id", getEmployeeController);
router.put("/edit/:id", auth(['hr',,'sub_hr_admin','admin','sub_admin']), editEmployeeController);
router.patch("/flag/:id", auth(['hr','sub_hr_admin', 'admin', 'sub_admin']), flagEmployeeController);
router.patch("/allocate-credit/:id", auth(['hr','sub_hr_admin','admin','sub_admin']), allocateCreditEmployeeController);
router.patch("/suspend/:id", auth(['hr','sub_hr_admin','admin','sub_admin']), suspendEmployeeController);
router.patch("/note/:id", auth(['hr','sub_hr_admin','admin','sub_admin']), addNoteController);
router.patch("/active/:id", auth(['hr','sub_hr_admin','admin','sub_admin']), activeEmployeeController);
router.patch("/delete/:id", auth(['hr','sub_hr_admin','admin','sub_admin']), deleteEmployeeController);

module.exports = router;