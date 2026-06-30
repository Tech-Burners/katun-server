const express = require("express");
const { addEmployerController, getEmployerController, editEmployerController, deleteEmployerController, getAllEmployerController, suspendEmployerController, activeEmployerController, flagEmployerController, allocateCreditEmployerController, noteToEmployerController } = require("./employer.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();

router.post("/add", auth(['admin', 'sub_admin']), addEmployerController);
router.get("/admin/all", getAllEmployerController);
router.get("/:id", getEmployerController)
router.put("/edit/:id", auth(['admin', 'sub_admin']), editEmployerController);
router.patch("/suspend/:id", auth(['admin', 'sub_admin']), suspendEmployerController); 
router.patch("/flag/:employerId", auth(["admin", "sub_admin"]), flagEmployerController)
router.patch("/note/:employerId", auth(["admin", "sub_admin"]), noteToEmployerController)
router.patch("/allocate-credit/:employerId", auth(["admin", "sub_admin"]), allocateCreditEmployerController)
router.patch("/active/:id", auth(['admin', 'sub_admin']), activeEmployerController); 
router.patch("/deleted/:id", auth(['admin', 'sub_admin']), deleteEmployerController); 

module.exports = router;