const notificationModel = require("../modules/Notification/notification.model");

const notificationCount = async (targetUser) => {
  return await notificationModel.countDocuments({targetUser:targetUser, isRead: false})
}

const admiNotificationCount = async () => {
  return await notificationModel.countDocuments({forAdmin:true, isRead: false})
}

module.exports = {notificationCount , admiNotificationCount};