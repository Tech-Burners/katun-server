const Api = require('twilio/lib/rest/Api');
const stuffModel = require('./staffs.model');
const ApiError = require('../../helpers/ApiError');
const { default: status } = require('http-status');


const addStuff = async (data) => {
    const exist = await stuffModel.findOne({ name: data.name });
    if (exist) {
        throw new ApiError(status.BAD_REQUEST, 'Staff already exist');
    }
    return await stuffModel.create(data);
}

const getStuff = async () => {
    return await stuffModel.find({ isDeleted: false });
}

const updateStuff = async (id, data) => {
    return await stuffModel.updateOne({ _id: id }, data, { new: true });
}



module.exports = { addStuff, getStuff , updateStuff }