const availabilityModel = require("./availability.model");

const addAvailabilityService = async (availabilityData) => {
    const { service, slot } = availabilityData;

    let availabilityDoc = await availabilityModel.findOne({ service });

    if (availabilityDoc) {
        // Filter out slots that already exist
        const newSlots = slot.filter(s => {
            return !availabilityDoc.slot.some(existing => 
                existing.startTime.getTime() === new Date(s.startTime).getTime() &&
                existing.endTime.getTime() === new Date(s.endTime).getTime()
            );
        });

        if (newSlots.length > 0) {
            availabilityDoc.slot.push(...newSlots);
            await availabilityDoc.save();
        }

        return availabilityDoc;
    } else {
        // Create a new availability document
        const newAvailability = await availabilityModel.create({ service, slot });
        return newAvailability;
    }
};


const editAvailabilityService = async (data) => {
    const result = await availabilityModel.findOneAndUpdate(
        { service: data.service },   // filter by service
        { slot: data.slot },         // update the slot array
        { new: true }                // return updated document
    );
    return result;
};


const deleteAvailabilityService = async (id) => {
    const result = await availabilityModel.findByIdAndDelete(id);
    return result;
};

const availabilityForAServiceService = async (id) => {
    const result = await availabilityModel.findOne({ service: id });
    return result;
}

module.exports = { addAvailabilityService, editAvailabilityService, deleteAvailabilityService, availabilityForAServiceService };