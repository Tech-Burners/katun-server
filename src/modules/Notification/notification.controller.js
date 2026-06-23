const { default: status } = require("http-status");
const { addNotificationService, getNotificationService, updateNotificationService, sentNotificationByFcmService } = require("./notification.service");
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");


const addNotification = catchAsync(async (req, res) => {
    const notification = await addNotificationService(req.body);
    return res.status(status.CREATED).json(response({ status: 'Success', statusCode: status.CREATED, type: 'notification', message: 'notification-added', data: notification }));
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

const sentNotificationByFcmController = catchAsync(async (req, res) => {
    
    const data = req.body;
    console.log({data})

    const result = await sentNotificationByFcmService(data);

    return res.status(status.OK).json(response({ status: 'Success', statusCode: status.OK, type: 'notification', message: 'notification-read', data: result }));
})

module.exports = { addNotification,adminNotification, readNotification , sentNotificationByFcmController}