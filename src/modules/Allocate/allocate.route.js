const express = require("express");
const { addAllocateController, editAllocateController, deleteAllocateController , getAllAllocateController, pauseUnpauseAllocateController, reclaimAllocatedCreditController } = require("./allocate.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();


router.post("/add", auth(['hr', 'sub_hr_admin', 'admin', 'sub_admin']), addAllocateController);
router.get("/all",auth(['hr','sub_hr_admin','admin', 'sub_admin']), getAllAllocateController);
router.post("/reclaim-to-hr", auth(['admin', 'sub_admin']), reclaimAllocatedCreditController);
router.patch("/reclaim-to-hr", auth(['admin', 'sub_admin']), reclaimAllocatedCreditController);
router.put("/edit/:id", editAllocateController);
router.delete("/delete/:id", deleteAllocateController);
router.patch("/pause-unpause/:id", auth(['hr', 'sub_hr_admin', 'admin', 'sub_admin']), pauseUnpauseAllocateController);

module.exports = router;