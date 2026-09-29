const availabilityModel = require("./availability.model");
const bookingModel = require("../Booking/booking.model");
const ApiError = require("../../helpers/ApiError");
const { default: status } = require("http-status");

const normalizeSlot = (s) => ({
    startTime: new Date(s.startTime),
    endTime: new Date(s.endTime),
    capacity: Math.max(1, Number(s.capacity || s.maxBookings || s.serviceCount || s.quantity || 1))
});

const addAvailabilityService = async (availabilityData) => {
    const { service, slot = [] } = availabilityData;

    let availabilityDoc = await availabilityModel.findOne({ service });

    if (availabilityDoc) {
        for (const s of slot) {
            const incomingStart = new Date(s.startTime).getTime();
            const incomingEnd = new Date(s.endTime).getTime();
            const incomingCapacity = Math.max(1, Number(s.capacity || s.maxBookings || s.serviceCount || s.quantity || 1));

            const existingIndex = availabilityDoc.slot.findIndex(existing =>
                existing.startTime.getTime() === incomingStart &&
                existing.endTime.getTime() === incomingEnd
            );

            if (existingIndex !== -1) {
                availabilityDoc.slot[existingIndex].capacity = incomingCapacity;
            } else {
                availabilityDoc.slot.push({
                    startTime: new Date(s.startTime),
                    endTime: new Date(s.endTime),
                    capacity: incomingCapacity
                });
            }
        }

        await availabilityDoc.save();
        return availabilityDoc;
    } else {
        const normalizedSlots = slot.map(normalizeSlot);
        const newAvailability = await availabilityModel.create({ service, slot: normalizedSlots });
        return newAvailability;
    }
};

const editAvailabilityService = async (data) => {
    const normalizedSlots = (data.slot || []).map(normalizeSlot);
    const result = await availabilityModel.findOneAndUpdate(
        { service: data.service },   // filter by service
        { slot: normalizedSlots },   // update the slot array with normalized capacities
        { new: true }                // return updated document
    );
    return result;
};

const deleteAvailabilityService = async (id) => {
    const result = await availabilityModel.findByIdAndDelete(id);
    return result;
};

const availabilityForAServiceService = async (id, onlyAvailable = false) => {
    const availability = await availabilityModel.findOne({ service: id }).lean();
    if (!availability) {
        return null;
    }

    const bookings = await bookingModel.find({
        service: id,
        status: { $ne: "cancelled" }
    }).select("startTime endTime status").lean();

    let enrichedSlots = (availability.slot || []).map(s => {
        const slotStartTime = new Date(s.startTime).getTime();
        const slotEndTime = new Date(s.endTime).getTime();
        const sStart = new Date(s.startTime);
        const sEnd = new Date(s.endTime);
        const capacity = Math.max(1, Number(s.capacity || 1));

        const bookedCount = bookings.filter(b => {
            const bStart = new Date(b.startTime);
            const bEnd = new Date(b.endTime);
            const exactMatch = bStart.getTime() === slotStartTime && bEnd.getTime() === slotEndTime;
            const timeMatch = (
                bStart.getUTCHours() === sStart.getUTCHours() &&
                bStart.getUTCMinutes() === sStart.getUTCMinutes() &&
                bEnd.getUTCHours() === sEnd.getUTCHours() &&
                bEnd.getUTCMinutes() === sEnd.getUTCMinutes()
            );
            return exactMatch || timeMatch;
        }).length;

        const remainingCapacity = Math.max(0, capacity - bookedCount);
        const isBooked = bookedCount >= capacity;

        return {
            ...s,
            capacity,
            bookedCount,
            remainingCapacity,
            isBooked
        };
    });

    if (onlyAvailable) {
        enrichedSlots = enrichedSlots.filter(s => !s.isBooked);
    }

    return {
        ...availability,
        slot: enrichedSlots
    };
};

/**
 * Checks whether a specific time slot is still available for booking.
 * Supports exact datetime matching as well as time-of-day (hours/minutes) matching.
 * Throws ApiError if service has no availability, slot does not exist, or slot is fully booked.
 */
const checkSlotAvailability = async (serviceId, startTime, endTime) => {
    if (!startTime || !endTime) {
        return;
    }

    const availability = await availabilityModel.findOne({ service: serviceId });
    if (!availability || !availability.slot || availability.slot.length === 0) {
        throw new ApiError(status.BAD_REQUEST, "No availability found for this service");
    }

    const reqStart = new Date(startTime);
    const reqEnd = new Date(endTime);

    if (isNaN(reqStart.getTime()) || isNaN(reqEnd.getTime())) {
        throw new ApiError(status.BAD_REQUEST, "Invalid start or end time format");
    }

    const reqStartTime = reqStart.getTime();
    const reqEndTime = reqEnd.getTime();

    // 1. Exact datetime timestamp match
    let matchingSlot = availability.slot.find(s =>
        new Date(s.startTime).getTime() === reqStartTime &&
        new Date(s.endTime).getTime() === reqEndTime
    );

    // 2. ISO string match (ignoring milliseconds)
    if (!matchingSlot) {
        const reqStartISO = reqStart.toISOString().slice(0, 19);
        const reqEndISO = reqEnd.toISOString().slice(0, 19);
        matchingSlot = availability.slot.find(s => {
            const sStartISO = new Date(s.startTime).toISOString().slice(0, 19);
            const sEndISO = new Date(s.endTime).toISOString().slice(0, 19);
            return sStartISO === reqStartISO && sEndISO === reqEndISO;
        });
    }

    // 3. Time-of-day match (same start hour/min and end hour/min, UTC or local)
    if (!matchingSlot) {
        matchingSlot = availability.slot.find(s => {
            const sStart = new Date(s.startTime);
            const sEnd = new Date(s.endTime);

            const utcMatch = (
                sStart.getUTCHours() === reqStart.getUTCHours() &&
                sStart.getUTCMinutes() === reqStart.getUTCMinutes() &&
                sEnd.getUTCHours() === reqEnd.getUTCHours() &&
                sEnd.getUTCMinutes() === reqEnd.getUTCMinutes()
            );

            const localMatch = (
                sStart.getHours() === reqStart.getHours() &&
                sStart.getMinutes() === reqStart.getMinutes() &&
                sEnd.getHours() === reqEnd.getHours() &&
                sEnd.getMinutes() === reqEnd.getMinutes()
            );

            return utcMatch || localMatch;
        });
    }

    if (!matchingSlot) {
        const slotDescriptions = availability.slot.map(s => {
            const start = new Date(s.startTime);
            const end = new Date(s.endTime);
            const timeStr = `${String(start.getUTCHours()).padStart(2, '0')}:${String(start.getUTCMinutes()).padStart(2, '0')} - ${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')} UTC`;
            return `${timeStr} (capacity: ${s.capacity || 1})`;
        }).join("; ");

        throw new ApiError(
            status.BAD_REQUEST,
            `Selected time slot is not available for this service. Available slots: ${slotDescriptions}`
        );
    }

    const slotCapacity = Math.max(1, Number(matchingSlot.capacity || 1));

    const bookedCount = await bookingModel.countDocuments({
        service: serviceId,
        status: { $ne: "cancelled" },
        $or: [
            { startTime: reqStart, endTime: reqEnd },
            { startTime: new Date(matchingSlot.startTime), endTime: new Date(matchingSlot.endTime) }
        ]
    });

    if (bookedCount >= slotCapacity) {
        throw new ApiError(status.BAD_REQUEST, "This time slot is fully booked");
    }

    return {
        slot: matchingSlot,
        capacity: slotCapacity,
        bookedCount,
        remainingCapacity: slotCapacity - bookedCount
    };
};

/**
 * Aggregation stages to filter services that have at least one unbooked slot.
 * If all slots for a service are booked, the service is excluded from the query results.
 */
const getUnbookedServiceStages = (serviceIdField = "$_id") => [
    {
        $lookup: {
            from: "availabilities",
            localField: serviceIdField === "$_id" ? "_id" : serviceIdField.replace(/^\$/, ""),
            foreignField: "service",
            as: "availabilityDoc",
        },
    },
    {
        $lookup: {
            from: "bookings",
            let: { serviceId: serviceIdField },
            pipeline: [
                {
                    $match: {
                        $expr: {
                            $and: [
                                { $eq: ["$service", "$$serviceId"] },
                                { $ne: ["$status", "cancelled"] },
                            ],
                        },
                    },
                },
                {
                    $project: {
                        startTime: 1,
                        endTime: 1,
                    },
                },
            ],
            as: "serviceBookings",
        },
    },
    {
        $addFields: {
            availableSlots: {
                $filter: {
                    input: {
                        $ifNull: [
                            { $arrayElemAt: ["$availabilityDoc.slot", 0] },
                            [],
                        ],
                    },
                    as: "slotItem",
                    cond: {
                        $lt: [
                            {
                                $size: {
                                    $filter: {
                                        input: "$serviceBookings",
                                        as: "b",
                                        cond: {
                                            $and: [
                                                { $eq: ["$$b.startTime", "$$slotItem.startTime"] },
                                                { $eq: ["$$b.endTime", "$$slotItem.endTime"] },
                                            ],
                                        },
                                    },
                                },
                            },
                            { $ifNull: ["$$slotItem.capacity", 1] },
                        ],
                    },
                },
            },
        },
    },
    {
        $match: {
            $expr: { $gt: [{ $size: "$availableSlots" }, 0] },
        },
    },
];

module.exports = {
    addAvailabilityService,
    editAvailabilityService,
    deleteAvailabilityService,
    availabilityForAServiceService,
    checkSlotAvailability,
    getUnbookedServiceStages,
};