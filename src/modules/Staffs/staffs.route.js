const express = require("express");
const { auth } = require("../../middlewares/auth");
const { addStuffController, getAllStuffController, editStuffController, deleteStuffController } = require("./staffs.controller");
const router = express.Router();

router.post("/add", auth(['partner', 'admin', 'sub_admin']), addStuffController);
router.get("/all", auth(['partner', 'admin', 'sub_admin']), getAllStuffController);
router.put("/edit/:id", auth(['partner', 'admin', 'sub_admin']), editStuffController);
router.patch("/deleted/:id", auth(['partner', 'admin', 'sub_admin']), deleteStuffController);
router.delete("/:id", auth(['partner', 'admin', 'sub_admin']), deleteStuffController);

module.exports = router;