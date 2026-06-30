const express = require("express");
const { auth } = require("../../middlewares/auth");
const { addReportController, getReportController, readUnreadReport, reportDetailsController, reportStatusUpdateController, countController } = require("./report.controller");
const router = express.Router();


router.post("/add", auth(['user', 'partner']), addReportController);
router.get('/count', countController)
router.get('/all', getReportController);
router.get('/details/:reportId', reportDetailsController);
router.patch('/status-update/:reportId', auth(['admin', 'sub_admin']), reportStatusUpdateController);


module.exports = router;