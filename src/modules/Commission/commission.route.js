const express = require("express");
const { auth } = require("../../middlewares/auth");
const { editCommissionController, deleteCommissionController, getAllCommissionController } = require("./commission.controller");
const router = express.Router();


router.put("/edit/:id", auth(['admin']), editCommissionController);
router.delete("/delete/:id", deleteCommissionController); //no need
router.get('/all', getAllCommissionController)


module.exports = router;