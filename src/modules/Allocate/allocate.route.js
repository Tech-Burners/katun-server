const express = require("express");
const { addAllocateController, editAllocateController, deleteAllocateController , getAllAllocateController, pauseUnpauseAllocateController } = require("./allocate.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();


router.post("/add", auth(['hr']), addAllocateController);
router.get("/all", getAllAllocateController);
router.put("/edit/:id", editAllocateController);
router.delete("/delete/:id", deleteAllocateController);
router.patch("/pause-unpause/:id", auth(['hr']), pauseUnpauseAllocateController);

module.exports = router;