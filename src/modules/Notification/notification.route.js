const express = require("express");
const { addNotification, readNotification, adminNotification, readAllNotification,
    sentNotificationByFcmController, myNotification } = require("./notification.controller");
const { auth } = require("../../middlewares/auth");
const { readAllNotificationService } = require("./notification.service");
const router = express.Router();


router.get("/",  auth(['user', 'partner', 'admin']), myNotification);
router.get("/notification-adminend",  auth(['admin']), adminNotification);
router.patch("/read-all",  auth(['admin', 'partner', 'user']), readAllNotification);
router.patch("/read/:id",  auth(['user', 'partner', 'admin']), readNotification);
router.post("/sentByFCMToken",sentNotificationByFcmController)


module.exports = router;