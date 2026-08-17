const { default: status } = require("http-status");
const { addNotificationService, getNotificationService, updateNotificationService, sentNotificationByFcmService, readAllNotificationService } = require("./notification.service");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");
const notificationModel = require("./notification.model");


const addNotification = catchAsync(async (req, res) => {
    const notification = await addNotificationService(req.body);
    return res.status(status.CREATED).json(response({ status: 'Success', statusCode: status.CREATED, type: 'notification', message: 'notification-added', data: notification }));
})


const myNotification = catchAsync(async (req, res) => {
    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    }
    const filters = {
        targetUser: req.User._id
    }
    const notification = await getNotificationService(options, filters);
    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'notification', message: 'notification-found', data: notification }));
})


const adminNotification = catchAsync(async (req, res) => {
    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    }
    const filters = {}
    const notification = await getNotificationService(options, filters);
    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'notification', message: 'notification-found', data: notification }));
})



const readNotification = catchAsync(async (req, res) => {
    const notification = await updateNotificationService(req.params.id, { isRead: true });
    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'notification', message: 'notification-read', data: notification }));
})

const readAllNotification = catchAsync(async (req, res) => {
    const notification = await readAllNotificationService();
    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'notification', message: 'notification-read', data: notification }));
})

const sentNotificationByFcmController = catchAsync(async (req, res) => {

    const data = req.body;
    // const targetUser = data.receiverId
    const result = await sentNotificationByFcmService(data);
    // const result = await notificationModel.create(req.body)

    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'notification', message: 'test notification send', data: result }));
})

module.exports = {
    addNotification, adminNotification,
    readNotification, myNotification,
    readAllNotification,
    sentNotificationByFcmController
}