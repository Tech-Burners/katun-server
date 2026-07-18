const express = require("express");
const { addEmployerController, getEmployerController, editEmployerController, deleteEmployerController, getAllEmployerController, suspendEmployerController, activeEmployerController, flagEmployerController, allocateCreditEmployerController, noteToEmployerController, bulkSuspendEmployerController, bulkActiveEmployerController, bulkDeleteEmployerController, bulkFlagEmployerController, bulkNoteToEmployerController, bulkAllocateCreditEmployerController } = require("./employer.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();

router.post("/add", auth(['admin', 'sub_admin']), addEmployerController);
router.get("/admin/all", getAllEmployerController);
router.get("/:id", getEmployerController)
router.put("/edit/:id", auth(['admin', 'sub_admin']), editEmployerController);
router.patch("/suspend/:id", auth(['admin', 'sub_admin']), suspendEmployerController); 
router.patch(
  "/bulk-suspend",
  auth(['admin', 'sub_admin']),
  bulkSuspendEmployerController
);
router.patch("/flag/:employerId", auth(["admin", "sub_admin"]), flagEmployerController)
router.patch(
  "/bulk-flag",
  auth(['admin', 'sub_admin']),
  bulkFlagEmployerController
);
router.patch("/note/:employerId", auth(["admin", "sub_admin"]), noteToEmployerController)
router.patch(
  "/bulk-note",
  auth(['admin', 'sub_admin']),
  bulkNoteToEmployerController
);
router.patch("/allocate-credit/:employerId", auth(["admin", "sub_admin"]), 
allocateCreditEmployerController)
router.patch(
  "/bulk-allocate-credit",
  auth(['admin', 'sub_admin']),
  bulkAllocateCreditEmployerController
);
router.patch("/active/:id", auth(['admin', 'sub_admin']), activeEmployerController); 
router.patch(
  "/bulk-active",
  auth(['admin', 'sub_admin']),
  bulkActiveEmployerController
);
router.patch("/deleted/:id", auth(['admin', 'sub_admin']), deleteEmployerController); 
router.patch(
  "/bulk-delete",
  auth(['admin', 'sub_admin']),
  bulkDeleteEmployerController
);

module.exports = router;