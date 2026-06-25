const { sendNotificationByFcmToken } = require('../../helpers/sendNotificationByFcmToken');
const notificationModel = require('./notification.model');


const addNotificationService = async (data) => {
    return await notificationModel.create(data);
}


const getNotificationService = async (options, filters) => {
    const { page = 1, limit = 10 } = options;
    const totalResults = await notificationModel.countDocuments(filters);
    const totalPages = Math.ceil(totalResults / limit);
    const notification = await notificationModel.find(filters).skip((page - 1) * limit).limit(limit);
    return { notification, pagination: { totalResults, totalPages, currentPage : page, limit } };
}

 
const updateNotificationService = async (id, data) => {
    return await notificationModel.findOneAndUpdate({ _id: id }, data, { new: true });
}

const readAllNotificationService = async () => {
    return await notificationModel.updateMany({ isRead: false }, { isRead: true });
}

const sentNotificationByFcmService = async (data) => {


    const {receiverId, textMessage} = data

    const result = await sendNotificationByFcmToken(receiverId, textMessage);

    return result;
}


module.exports = { 
    addNotificationService, 
    getNotificationService,
     updateNotificationService , 
    sentNotificationByFcmService,
    readAllNotificationService
}