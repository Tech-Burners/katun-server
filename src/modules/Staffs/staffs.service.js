const stuffModel = require('./staffs.model');
const ApiError = require('../../helpers/ApiError');
const { default: status } = require('http-status');

const addStuff = async (data) => {
    if (!data.name || !data.name.trim()) {
        throw new ApiError(status.BAD_REQUEST, 'Staff name is required');
    }
    if (!data.partnerId) {
        throw new ApiError(status.BAD_REQUEST, 'Partner ID is required');
    }

    const trimmedName = data.name.trim();
    const exist = await stuffModel.findOne({
        partnerId: data.partnerId,
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
        isDeleted: false
    });

    if (exist) {
        throw new ApiError(status.BAD_REQUEST, 'Staff already exists for this partner');
    }

    return await stuffModel.create({
        ...data,
        name: trimmedName
    });
};

const getStuff = async (partnerId, query = {}) => {
    const filter = { isDeleted: false };

    if (partnerId) {
        filter.partnerId = partnerId;
    }

    const search = query.search || query.name;
    if (search && search.trim()) {
        filter.name = { $regex: search.trim(), $options: 'i' };
    }

    return await stuffModel.find(filter).sort({ createdAt: -1 });
};

const updateStuff = async (id, data, partnerId) => {
    const filter = { _id: id, isDeleted: false };
    if (partnerId) {
        filter.partnerId = partnerId;
    }

    const staff = await stuffModel.findOne(filter);
    if (!staff) {
        throw new ApiError(status.NOT_FOUND, 'Staff not found');
    }

    const updateData = { ...data };
    if (updateData.name && updateData.name.trim()) {
        const trimmedName = updateData.name.trim();
        if (trimmedName.toLowerCase() !== staff.name.toLowerCase()) {
            const exist = await stuffModel.findOne({
                partnerId: staff.partnerId,
                name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
                isDeleted: false,
                _id: { $ne: id }
            });

            if (exist) {
                throw new ApiError(status.BAD_REQUEST, 'Staff with this name already exists');
            }
        }
        updateData.name = trimmedName;
    }

    return await stuffModel.findByIdAndUpdate(id, updateData, { new: true });
};

const deleteStuff = async (id, partnerId) => {
    const filter = { _id: id, isDeleted: false };
    if (partnerId) {
        filter.partnerId = partnerId;
    }

    const staff = await stuffModel.findOne(filter);
    if (!staff) {
        throw new ApiError(status.NOT_FOUND, 'Staff not found');
    }

    return await stuffModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
};

module.exports = { addStuff, getStuff, updateStuff, deleteStuff };