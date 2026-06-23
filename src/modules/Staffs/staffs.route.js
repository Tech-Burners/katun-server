const express = require("express");
const { auth } = require("../../middlewares/auth");
const { addStuffController, getAllStuffController, editStuffController, deleteStuffController } = require("./staffs.controller");
const router = express.Router();

router.post("/add", auth(['partner']), addStuffController);
router.get("/all", auth(['partner']), getAllStuffController)
router.put("/edit/:id", auth(['partner']), editStuffController);
router.patch("/deleted/:id", auth(['partner']), deleteStuffController); 

module.exports = router;