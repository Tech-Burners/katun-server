const express = require("express");
const { addBankController, deleteBankController, getMybankController, getAllRequestedbankController } = require("./bank.controller");
const { auth } = require("../../middlewares/auth");
const router = express.Router();

router.post("/add", auth(['partner']), addBankController);
router.get("/req-bank", getAllRequestedbankController);
router.get('/my-bank', auth(['partner']), getMybankController);
router.delete("/:id", auth(['partner']), deleteBankController);


module.exports = router;