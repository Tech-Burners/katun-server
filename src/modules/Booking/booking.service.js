const { default: mongoose } = require("mongoose");
const serviceModel = require("../Service/service.model");
const bookingModel = require("./booking.model");
const staffModel = require("../Staffs/staffs.model");
const { default: status } = require("http-status");
const ApiError = require("../../helpers/ApiError");
const generate4DigitPin = require("../../helpers/generatepin");
const Api = require("twilio/lib/rest/Api");
const feedbackModel = require("../FeedBack/feedback.model");
const User = require("../User/user.model");
const Transaction = require("../Transaction/transaction.model");
const userModel = require("../User/user.model");
const transactionModel = require("../Transaction/transaction.model");
const commissionModel = require("../Commission/commission.model");
const { sendNotificationByFcmToken } = require("../../helpers/sendNotificationByFcmToken");
const { addNotificationService } = require("../Notification/notification.service");
const { getOrCreateCycle } = require("../Payout/payout.service");
const payoutCycleModel = require("../Payout/payoutCycle.model");
const { emailWithNodemailer } = require("../../helpers/email");
const {
    calculateBookingRequestExpireAt,
    adjustPayoutCycleOnRefund,
} = require("./bookingExpiry.service");
const { checkSlotAvailability } = require("../Availability/availability.service");

const bookingService = async (data) => {

    const service = await serviceModel.findById(data.service);

    if (!service) {
        throw new ApiError(status.NOT_FOUND, "Service not found");
    }

    // Check slot availability and capacity
    if (data.startTime && data.endTime) {
        await checkSlotAvailability(data.service, data.startTime, data.endTime);
    }

    if (!data.isOneTime) {
        data.sessionLeft = service.pass.noOfSessions;
        data.expireDate = new Date(
            new Date(data.date).getTime() +
            service.pass.validity * 24 * 60 * 60 * 1000
        );
    }

    if (data.isOneTime) {
        data.sessionLeft = 1;
        data.expireDate = new Date(
            new Date(data.date).getTime() +
            1 * 24 * 60 * 60 * 1000
        );
    }

    // Set approval deadline if not already set
    if (!data.bookingRequestExpireAt) {
        data.bookingRequestExpireAt = calculateBookingRequestExpireAt(data);
    }
    if (data.expiryReminderSent === undefined) {
        data.expiryReminderSent = false;
    }

    data.pin = generate4DigitPin();

    /**
     * --------------------------------
     * CASH PAYMENT
     * --------------------------------
     */
    if (data.paymentMethod === "cash") {
        data.paymentStatus = "pending";
        return await bookingModel.create(data);
    }

    /**
     * --------------------------------
     * WALLET PAYMENT
     * --------------------------------
     */
    if (data.paymentMethod === "wallet") {

        const user = await User.findById(data.user);

        if (!user) {
            throw new ApiError(status.NOT_FOUND, "User not found");
        }

        if (user.digitalWallet < data.totalPrice) {
            throw new ApiError(
                status.BAD_REQUEST,
                "Insufficient wallet balance"
            );
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {

            const totalPrice = Number(data.totalPrice);
            user.digitalWallet = Number(
                (user.digitalWallet - totalPrice).toFixed(2)
            );

            if (user.allocatedCredit && user.allocatedCredit > 0) {
                const fromAllocated = Math.min(user.allocatedCredit, totalPrice);
                user.allocatedCredit = Number((user.allocatedCredit - fromAllocated).toFixed(2));
                const remainingToDeduct = Number((totalPrice - fromAllocated).toFixed(2));
                if (remainingToDeduct > 0 && user.rechargedCredit && user.rechargedCredit > 0) {
                    user.rechargedCredit = Math.max(0, Number((user.rechargedCredit - remainingToDeduct).toFixed(2)));
                }
            } else if (user.rechargedCredit && user.rechargedCredit > 0) {
                user.rechargedCredit = Math.max(0, Number((user.rechargedCredit - totalPrice).toFixed(2)));
            }

            await user.save({ session });

            data.paymentStatus = "paid";

            //  booking now contains providerLocation
            const booking = await bookingModel.create([data], { session });

            const commissionRate = 0.10;
            const grossAmount = Number(data.totalPrice);
            const commission = grossAmount * commissionRate;
            const netAmount = grossAmount - commission;

            const tx_ref = `txn_${Date.now()}_${data.user}`;

            const partnerUser = await userModel.findById(data.provider);
            const cycleType =
                partnerUser?.payoutFrequency === "instant"
                    ? "weekly"
                    : partnerUser?.payoutFrequency;

            const cycle = await getOrCreateCycle(
                data.provider,
                cycleType || "weekly"
            );

            const transaction = await Transaction.create([{
                tx_ref,
                user: data.user,
                partner: data.provider,
                service: data.service,
                user_email: user.email,
                amount: grossAmount,
                currency: "NGN",
                gross_amount: grossAmount,
                commission,
                net_amount: netAmount,
                payout_status: "pending",
                status: "successful",
                payment_method: "wallet",
                booking: booking[0]._id,
                payoutCycle: cycle._id,
                paymentType: "booking",
                description: "Wallet payment for service booking"
            }], { session });

            await payoutCycleModel.updateOne(
                { _id: cycle._id },
                {
                    $addToSet: { transactions: transaction[0]._id },
                    $inc: { totalAmount: netAmount }
                },
                { session }
            );

            booking[0].transaction = transaction[0]._id;
            await booking[0].save({ session });

            await session.commitTransaction();
            session.endSession();

            return booking[0];

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            throw error;
        }
    }

    /**
     * --------------------------------
     * DIGITAL PAYMENT
     * --------------------------------
     */
    // console.log("digital:::", { data })
    return await bookingModel.create(data);
};





const modifyBookingService = async (bookingId, loginUser, data) => {
    // console.log({ bookingId, loginUser, data })
    const booking = await bookingModel.findById(bookingId);
    if (!booking || loginUser != booking.user.toString() || booking.status != "approved") {
        // console.log("Unauthorized modification attempt", { loginUser, bookingUser: booking.user.toString(), bookingStatus: booking.status })
        throw new ApiError(status.BAD_REQUEST, "You can't modify this booking");
    }
    if (data.startTime && data.endTime) {
        await checkSlotAvailability(booking.service, data.startTime, data.endTime);
    }
    return await bookingModel.findByIdAndUpdate(bookingId, data, { new: true });
}

const checkPinService = async (bookingId, pin) => {
    const booking = await bookingModel.findById(bookingId);
    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }

    if (booking.pin == pin) {
        booking.pinVerified = true;
        await booking.save();

        let serviceName = "service";
        try {
            const serviceDoc = await serviceModel.findById(booking.service);
            if (serviceDoc?.name) {
                serviceName = serviceDoc.name;
            }
        } catch (_) {}

        const [userDoc, partnerUserDoc] = await Promise.all([
            userModel.findById(booking.user),
            userModel.findById(booking.provider),
        ]);

        const userTitle = "PIN Verified";
        const userMessage = `Your PIN for ${serviceName} has been verified successfully.`;
        const partnerTitle = "Customer PIN Verified";
        const partnerMessage = `Customer PIN for ${serviceName} (Booking ID: ${booking.bookingId || booking._id}) has been verified successfully.`;

        // 1. Notify User (Customer)
        if (userDoc) {
            if (userDoc.enabledPushNotification !== false) {
                await sendNotificationByFcmToken(
                    booking.user,
                    userTitle,
                    userMessage,
                    booking._id,
                    'booking'
                );
            }

            await addNotificationService({
                sender: booking.provider,
                targetUser: booking.user,
                title: userTitle,
                message: userMessage,
                type: "booking",
                bookingId: booking._id,
            });

            if (userDoc.email) {
                await emailWithNodemailer({
                    email: userDoc.email,
                    subject: userTitle,
                    html: `<p>Hello ${userDoc.fullName || "Valued Customer"},</p><p>${userMessage}</p><p><strong>Booking ID:</strong> ${booking.bookingId || booking._id}</p><p><strong>Service:</strong> ${serviceName}</p>`,
                }).catch((e) => console.error("User PIN verification email error:", e.message));
            }
        }

        // 2. Notify Provider (Partner)
        if (partnerUserDoc) {
            if (partnerUserDoc.enabledPushNotification !== false) {
                await sendNotificationByFcmToken(
                    booking.provider,
                    partnerTitle,
                    partnerMessage,
                    booking._id,
                    'booking'
                );
            }

            await addNotificationService({
                sender: booking.user,
                targetUser: booking.provider,
                title: partnerTitle,
                message: partnerMessage,
                type: "booking",
                bookingId: booking._id,
            });

            if (partnerUserDoc.email) {
                await emailWithNodemailer({
                    email: partnerUserDoc.email,
                    subject: partnerTitle,
                    html: `<p>Hello ${partnerUserDoc.fullName || "Partner"},</p><p>${partnerMessage}</p><p><strong>Booking ID:</strong> ${booking.bookingId || booking._id}</p><p><strong>Service:</strong> ${serviceName}</p>`,
                }).catch((e) => console.error("Partner PIN verification email error:", e.message));
            }
        }

        return true;
    }
    else {
        throw new ApiError(status.BAD_REQUEST, 'Pin not matched');
    }
};


const markAsCompletedService = async (id, data) => {
    const booking = await bookingModel.findById(id);
    if (booking.pinVerified == true && booking.status == 'approved') {
        if (booking.sessionLeft <= 0) {
            throw new ApiError(status.BAD_REQUEST, 'No sessions left in this booking');
        }
        booking.sessionLeft -= 1;
        booking.checkin = new Date();
        if (booking.sessionLeft == 0) {
            booking.status = 'completed';
        }
        booking.pin = generate4DigitPin();
        booking.pinVerified = false;
        await booking.save();

        let serviceName = "service";
        try {
            const serviceDoc = await serviceModel.findById(booking.service);
            if (serviceDoc?.name) {
                serviceName = serviceDoc.name;
            }
        } catch (_) {}

        const receiverData = await userModel.findById(booking.user);
        const title = "Service Completed";
        const message = `Your service for ${serviceName} has been marked as completed.`;

        // 1. Push Notification
        if (receiverData && receiverData.enabledPushNotification !== false) {
            await sendNotificationByFcmToken(
                booking.user,
                title,
                message,
                booking._id,
                'booking',
            );
        }

        // 2. In-App Notification
        await addNotificationService({
            sender: booking.provider,
            targetUser: booking.user,
            title,
            message,
            type: "booking",
            bookingId: booking._id,
        });

        // 3. Email Notification
        if (receiverData?.email) {
            await emailWithNodemailer({
                email: receiverData.email,
                subject: title,
                html: `<p>Hello ${receiverData.fullName || "Valued Customer"},</p><p>Your service for <strong>${serviceName}</strong> has been marked as completed.</p>`,
            }).catch((e) => console.error("Completion email error:", e.message));
        }

        return true;
    }
    else {
        throw new ApiError(status.BAD_REQUEST, 'You can not mark as completed');
    }
};


const bookingFeedbackService = async (data) => {
    const booking = await bookingModel.findById(data.booking);
    const service = await serviceModel.findById(booking.service);
    console.log({ booking, service })
    const feedback = await feedbackModel.findOne({ booking: data.booking, sender: data.user });
    if (feedback) {
        throw new ApiError(status.BAD_REQUEST, 'You already give feedback');
    }

    await feedbackModel.create({
        sender: data.user,
        targetUser: data.targetUser,
        service: booking.service,
        booking: data.booking,
        rating: data.rating,
        text: data.review,
        isAppFeedback: false
    })
    const newRating = data.rating;

    // First time rating only
    if (newRating) {
        service.totalRating += newRating;
        service.ratingCount += 1;
    }

    // Calculate average
    service.avgRating =
        service.ratingCount > 0
            ? service.totalRating / service.ratingCount
            : 0;

    await service.save();

    return true;
};



// const serviceFeedbackService = async (data) => {
//     const feedback = await feedbackModel.findOne({ service: data.service, sender: data.user });
//     if(feedback){
//         throw new ApiError(status.BAD_REQUEST, 'You already give feedback');
//     }


//     const service = await serviceModel.findById(data.service);

//     if (!service) {
//         throw new ApiError(status.NOT_FOUND, 'Service not found');
//     }


//     await feedbackModel.create({
//         sender: data.user,
//         targetUser: data.targetUser,
//         service: data.service,
//         rating: data.rating,
//         text: data.review,
//         isAppFeedback: false
//     })
//     const newRating = data.rating;

//     // First time rating only
//     if (newRating) {
//         service.totalRating += newRating;
//         service.ratingCount += 1;
//     }

//     // Calculate average
//     service.avgRating =
//         service.ratingCount > 0
//             ? service.totalRating / service.ratingCount
//             : 0;

//     await service.save();

//     return true;
// };


const approveBookingService = async (id) => {
    const now = new Date();
    const booking = await bookingModel.findById(id);

    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }

    if (booking.status !== "pending") {
        throw new ApiError(status.BAD_REQUEST, `Booking is already ${booking.status}`);
    }

    // Requirement 10: Expired booking (service time has passed) cannot be approved even if cron has not run yet
    const isExpired =
        (booking.bookingRequestExpireAt && booking.bookingRequestExpireAt <= now) ||
        (!booking.bookingRequestExpireAt && booking.date && new Date(booking.date) <= now);

    if (isExpired) {
        throw new ApiError(status.BAD_REQUEST, "This booking request service time has passed and cannot be approved");
    }

    const result = await bookingModel.findOneAndUpdate(
        {
            _id: id,
            status: "pending",
            $or: [
                { bookingRequestExpireAt: { $gt: now } },
                {
                    bookingRequestExpireAt: { $exists: false },
                    date: { $gt: now }
                },
                {
                    bookingRequestExpireAt: null,
                    date: { $gt: now }
                }
            ]
        },
        { status: "approved" },
        { new: true }
    );

    if (!result) {
        throw new ApiError(status.BAD_REQUEST, 'Unable to approve booking. Service time may have passed or booking was already updated.');
    }

    const service = await serviceModel.findById(result.service);
    const serviceName = service?.name || "service";
    const userData = await userModel.findById(result.user);
    const title = "Booking Approved";
    const message = `Your booking for ${serviceName} has been approved.`;

    // 1. Push Notification
    if (userData && userData.enabledPushNotification !== false) {
        await sendNotificationByFcmToken(
            result.user,
            title,
            message,
            result._id,
            'booking'
        );
    }

    // 2. In-App Notification
    await addNotificationService(
        {
            sender: result.provider,
            targetUser: result.user,
            title,
            message,
            type: "booking",
            bookingId: result._id,
        }
    );

    // 3. Email Notification
    if (userData?.email) {
        await emailWithNodemailer({
            email: userData.email,
            subject: title,
            html: `<p>Hello ${userData.fullName || "Valued Customer"},</p><p>Your booking for <strong>${serviceName}</strong> has been approved by the provider.</p>`,
        }).catch((e) => console.error("Approval email error:", e.message));
    }

    return result;
};


const cancelBookingService = async (id, reason) => {
    const booking = await bookingModel.findById(id);
    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }
    if (booking.status === 'completed') {
        throw new ApiError(status.BAD_REQUEST, "Completed booking cannot be cancelled");
    }
    if (booking.status === 'cancelled') {
        throw new ApiError(status.BAD_REQUEST, "Booking is already cancelled");
    }

    const result = await bookingModel.findOneAndUpdate(
        { _id: id, status: { $ne: "cancelled" } },
        {
            status: "cancelled",
            reason: reason || "Cancelled by provider",
        },
        { new: true }
    );

    if (!result) {
        throw new ApiError(status.BAD_REQUEST, 'Unable to cancel booking');
    }

    // Mark original transaction as refunded and adjust cycle
    const originalTransactionId = result.transaction;
    if (originalTransactionId) {
        const updatedTx = await Transaction.findByIdAndUpdate(
            originalTransactionId,
            {
                payout_status: "refund",
                payment_status: "refunded",
                status: "refunded",
                paymentType: "refund",
                refund_status: "completed",
                refund_at: new Date(),
                refund_reason: reason || "Cancelled by provider",
            },
            { new: true }
        );
        if (updatedTx) {
            await adjustPayoutCycleOnRefund(updatedTx);
        }
    }

    let serviceName = "service";
    try {
        const serviceDoc = await serviceModel.findById(result.service);
        if (serviceDoc?.name) {
            serviceName = serviceDoc.name;
        }
    } catch (_) {}

    const receiverData = await userModel.findById(result.user);
    const title = "Booking Cancelled";
    const message = `Your booking for ${serviceName} has been cancelled by the provider.`;

    // 1. Push Notification
    if (receiverData && receiverData.enabledPushNotification !== false) {
        await sendNotificationByFcmToken(
            result.user,
            title,
            message,
            result._id,
            'booking'
        );
    }

    // 2. In-App Notification
    await addNotificationService(
        {
            sender: result.provider,
            targetUser: result.user,
            title,
            message,
            type: "booking",
            bookingId: result._id,
        }
    );

    // 3. Email Notification
    if (receiverData?.email) {
        await emailWithNodemailer({
            email: receiverData.email,
            subject: title,
            html: `<p>Hello ${receiverData.fullName || "Valued Customer"},</p><p>${message}</p>`,
        }).catch((e) => console.error("Cancellation email error:", e.message));
    }

    return result;
};

const assignStuffService = async (id, stuff) => {
    const now = new Date();
    const booking = await bookingModel.findById(id);

    if (!booking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }

    if (booking.status === "cancelled") {
        throw new ApiError(status.BAD_REQUEST, "Cannot assign staff to a cancelled booking");
    }

    if (booking.status === "completed") {
        throw new ApiError(status.BAD_REQUEST, "Booking is already completed");
    }

    if (booking.status === "pending") {
        const isExpired =
            (booking.bookingRequestExpireAt && booking.bookingRequestExpireAt <= now) ||
            (!booking.bookingRequestExpireAt && booking.date && new Date(booking.date) <= now);

        if (isExpired) {
            throw new ApiError(status.BAD_REQUEST, "This booking request service time has passed and cannot be approved or assigned");
        }
    }

    if (stuff) {
        const staffMember = await staffModel.findOne({
            _id: stuff,
            isDeleted: false,
        });

        if (!staffMember) {
            throw new ApiError(status.NOT_FOUND, "Staff not found");
        }

        if (booking.provider && staffMember.partnerId && staffMember.partnerId.toString() !== booking.provider.toString()) {
            throw new ApiError(status.BAD_REQUEST, "Assigned staff does not belong to this provider");
        }
    }

    const result = await bookingModel.findOneAndUpdate(
        {
            _id: id,
            $or: [
                { status: "approved" },
                {
                    status: "pending",
                    $or: [
                        { bookingRequestExpireAt: { $gt: now } },
                        {
                            bookingRequestExpireAt: { $exists: false },
                            date: { $gt: now }
                        },
                        {
                            bookingRequestExpireAt: null,
                            date: { $gt: now }
                        }
                    ]
                }
            ]
        },
        { assignedTo: stuff, status: "approved" },
        { new: true }
    );

    if (!result) {
        throw new ApiError(status.BAD_REQUEST, 'Unable to assign staff. Booking service time may have passed.');
    }

    let service;
    if (result.status === "approved") {
        service = await serviceModel.findById(result.service);
    }
    const serviceName = service?.name || "service";
    const userData = await userModel.findById(result.user);
    if (userData && userData.enabledPushNotification) {
        await sendNotificationByFcmToken(
            result.user,
            'booking approval',
            `your booking for ${serviceName} has been approved`,
            result._id,
            'booking'
        );
    }
    await addNotificationService(
        {
            sender: result.provider,
            targetUser: result.user,
            title: `booking approval`,
            message: `Your booking for ${serviceName} has been approved`,
            type: "booking",
            bookingId: result._id,
        }
    );
    const userEmail = await userModel.findOne({ _id: result.user }).select('email');
    if (userEmail?.email) {
        await emailWithNodemailer({
            email: userEmail.email,
            subject: "Booking Approved",
            html: `Your booking for ${serviceName} has been approved`,
        }).catch((e) => console.error("Email error:", e.message));
    }

    return result;
};

const completeBookingService = async (id) => {
    const booking = await bookingModel.findById(id);
    // console.log({ booking })
    const provider = await userModel.findOne({ _id: booking.provider })
    // console.log({ provider })
    const service = await serviceModel.findOne({ _id: booking.service })
    // console.log({ service })
    const comission = await commissionModel.findOne({ category: service.category })
    // console.log({ comission })
    comissionAmount = booking.totalPrice * comission.commission
    if (booking.paymentMethod === 'cash') {
        if (provider.digitalWallet < comissionAmount) {
            throw new ApiError(412, "insufficient provider balance")
        } else {
            provider.digitalWallet -= comissionAmount;
        }
    }
    if (booking.paymentMethod === 'wallet') {
        provider.digitalWallet += comissionAmount;
    }
    provider.save();
    const updatedBooking = await bookingModel.findOneAndUpdate(
        {
            _id: id,
            status: "approved"
        },
        {
            status: "completed"
        },
        {
            new: true
        }
    );

    if (!updatedBooking) {
        throw new ApiError(status.NOT_FOUND, 'Booking not found');
    }
    const receiverData = await userModel.findById(updatedBooking.user);
    // console.log({ receiverData })
    if (receiverData && receiverData.enabledPushNotification) {
        await sendNotificationByFcmToken(
            updatedBooking.user,
            'booking completion',
            `your booking for ${service.name} has been completed`,
            updatedBooking._id,
            'booking'
        )
    }
    await addNotificationService(
        {
            sender: updatedBooking.provider,
            targetUser: updatedBooking.user,
            title: `booking completion`,
            message: `your booking for ${service.name} has been completed`,
            type: "booking",
        }
    )
    const userEmail = await userModel.findOne({ _id: updatedBooking.user }).select('email');
    // console.log(userEmail.email)
    await emailWithNodemailer({
        //   email: 'mdnasifurahman@gmail.com',
        email: userEmail.email,
        subject: "Service Completed",
        html: `Your service ${service.name} has been completed`,
    });


    return updatedBooking;
}


const bookingDetailsService = async (id, loginUserId) => {

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new Error("Invalid booking id");
    }

    if (!loginUserId || !mongoose.Types.ObjectId.isValid(loginUserId)) {
        throw new Error("Invalid user id");
    }

    const objectBookingId = new mongoose.Types.ObjectId(id);
    const objectUserId = new mongoose.Types.ObjectId(loginUserId);

    const result = await bookingModel.aggregate([
        {
            $match: {
                _id: objectBookingId
            }
        },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },
        { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "users",
                localField: "serviceData.user",
                foreignField: "_id",
                as: "partnerData"
            }
        },
        { $unwind: { path: "$partnerData", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "partners",
                let: {
                    serviceUserId: "$serviceData.user",
                    providerId: "$provider"
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $or: [
                                    {
                                        $and: [
                                            { $ne: ["$$serviceUserId", null] },
                                            { $eq: ["$user", "$$serviceUserId"] }
                                        ]
                                    },
                                    {
                                        $and: [
                                            { $ne: ["$$providerId", null] },
                                            { $eq: ["$user", "$$providerId"] }
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    { $limit: 1 }
                ],
                as: "partnerProfileData"
            }
        },
        { $unwind: { path: "$partnerProfileData", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: 'feedbacks',
                localField: '_id',
                foreignField: 'booking',
                as: 'feedbackData'
            }
        },
        {
            $addFields: {
                myFeedback: {
                    $arrayElemAt: [
                        {
                            $map: {
                                input: {
                                    $filter: {
                                        input: "$feedbackData",
                                        as: "fb",
                                        cond: { $eq: ["$$fb.sender", objectUserId] }
                                    }
                                },
                                as: "fb",
                                in: {
                                    text: "$$fb.text",
                                    rating: "$$fb.rating"
                                }
                            }
                        },
                        0
                    ]
                },

                oppositeFeedback: {
                    $arrayElemAt: [
                        {
                            $map: {
                                input: {
                                    $filter: {
                                        input: "$feedbackData",
                                        as: "fb",
                                        cond: { $ne: ["$$fb.sender", objectUserId] }
                                    }
                                },
                                as: "fb",
                                in: {
                                    text: "$$fb.text",
                                    rating: "$$fb.rating"
                                }
                            }
                        },
                        0
                    ]
                }
            }
        },

        {
            $project: {

                bookingId: '$_id',
                pinVerified: 1,
                customBookingId: "$bookingId",
                serviceName: '$serviceData.name',
                serviceId: '$serviceData._id',
                endTime: 1,
                tips: 1,
                startTime: 1,
                providerName: '$partnerData.fullName',
                providerId: '$partnerData._id',
                number: '$partnerData.number',
                countryCode: '$partnerData.countryCode',
                location: '$partnerData.location',
                address: '$partnerData.address',
                servicePrice: 1,
                totalPrice: 1,
                sessionLeft: 1,
                date: 1,
                pin: 1,
                addons: 1,
                status: 1,
                isOneTime: 1,
                createdAt: 1,
                amenities: { $ifNull: ["$partnerProfileData.amenities", []] },
                myFeedback: 1,
                oppositeFeedback: 1
            }
        }
    ]);

    return result[0] || null;
};


const bookingDetailsAdminEndService = async (id, loginUserId) => {
    const objectBookingId = new mongoose.Types.ObjectId(String(id));
    const objectUserId = new mongoose.Types.ObjectId(String(loginUserId));

    const result = await bookingModel.aggregate([
        {
            $match: {
                _id: objectBookingId
            }
        },

        {
            $lookup: {
                from: 'services',
                localField: 'service',
                foreignField: '_id',
                as: 'serviceData'
            }
        },
        {
            $unwind: {
                path: '$serviceData',
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                as: 'userData'
            }
        },
        {
            $unwind: {
                path: '$userData',
                preserveNullAndEmptyArrays: true
            }
        },

        // partner
        {
            $lookup: {
                from: 'partners',
                let: {
                    serviceUserId: '$serviceData.user',
                    providerId: '$provider'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $or: [
                                    {
                                        $and: [
                                            { $ne: ['$$serviceUserId', null] },
                                            { $eq: ['$user', '$$serviceUserId'] }
                                        ]
                                    },
                                    {
                                        $and: [
                                            { $ne: ['$$providerId', null] },
                                            { $eq: ['$user', '$$providerId'] }
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    { $limit: 1 }
                ],
                as: 'partnerData'
            }
        },
        {
            $unwind: {
                path: '$partnerData',
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: 'staffs',
                localField: 'assignedTo',
                foreignField: '_id',
                as: 'assignedToData'
            }
        },
        {
            $unwind: {
                path: '$assignedToData',
                preserveNullAndEmptyArrays: true
            }
        },

        // ❗ KEEP ARRAY (IMPORTANT FIX)
        {
            $lookup: {
                from: 'feedbacks',
                localField: '_id',
                foreignField: 'booking',
                as: 'feedbackData'
            }
        },

        // ✅ ADD FEEDBACK SPLIT LOGIC
        {
            $addFields: {
                myFeedback: {
                    $arrayElemAt: [
                        {
                            $map: {
                                input: {
                                    $filter: {
                                        input: "$feedbackData",
                                        as: "fb",
                                        cond: { $eq: ["$$fb.sender", objectUserId] }
                                    }
                                },
                                as: "fb",
                                in: {
                                    text: "$$fb.text",
                                    rating: "$$fb.rating"
                                }
                            }
                        },
                        0
                    ]
                },

                oppositeFeedback: {
                    $arrayElemAt: [
                        {
                            $map: {
                                input: {
                                    $filter: {
                                        input: "$feedbackData",
                                        as: "fb",
                                        cond: { $ne: ["$$fb.sender", objectUserId] }
                                    }
                                },
                                as: "fb",
                                in: {
                                    text: "$$fb.text",
                                    rating: "$$fb.rating"
                                }
                            }
                        },
                        0
                    ]
                }
            }
        },

        {
            $project: {
                pinVerified: 1,
                bookingId: '$_id',
                customBookingId: "$bookingId",
                serviceName: '$serviceData.name',
                serviceId: '$serviceData._id',
                userName: '$userData.fullName',
                userId: '$userData._id',
                userImage: '$userData.image',
                userNumber: '$userData.number',
                userCountryCode: '$userData.countryCode',
                number: '$userData.number',
                countryCode: '$userData.countryCode',
                assignedStaff: '$assignedToData.name',
                addons: 1,
                servicefee: '$serviceData.servicefee',
                duration: '$serviceData.duration',
                totalPrice: 1,
                sessionLeft: 1,
                date: 1,
                pin: 1,
                tips: 1,
                status: 1,
                isOneTime: 1,
                pass: 1,
                createdAt: 1,
                amenities: { $ifNull: ['$partnerData.amenities', []] },

                myFeedback: 1,
                oppositeFeedback: 1
            }
        }
    ]);

    return result[0] || null;
};

const userPendingBookingService = async (user, option) => {
    const { page, limit } = option;
    const skip = (page - 1) * limit;
    const now = new Date();

    const paymentMatch = [
        { paymentMethod: "cash" },
        { paymentMethod: { $ne: "cash" }, paymentStatus: "paid" }
    ];

    const userObjId = mongoose.Types.ObjectId.isValid(user)
        ? new mongoose.Types.ObjectId(String(user))
        : null;

    const [result, total] = await Promise.all([
        bookingModel.aggregate([
            {
                $match: {
                    user: userObjId ? { $in: [userObjId, String(user)] } : user,
                    status: "pending",
                    expireDate: { $gte: now },
                    $or: paymentMatch
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            },
            {
                $lookup: {
                    from: 'services',
                    localField: 'service',
                    foreignField: '_id',
                    as: 'serviceData'
                }
            },
            {
                $unwind: {
                    path: '$serviceData',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'serviceData.user',
                    foreignField: '_id',
                    as: 'userData'
                }
            },
            {
                $unwind: {
                    path: '$userData',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    customBookingId: "$bookingId",
                    image: '$serviceData.image',
                    serviceName: '$serviceData.name',
                    serviceId: '$serviceData._id',
                    providerName: '$userData.fullName',
                    sessionLeft: 1,
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    createdAt: 1
                }
            }
        ]),
        bookingModel.countDocuments({
            user: new mongoose.Types.ObjectId(String(user)),
            status: "pending",
            expireDate: { $gte: now }
        })
    ])
    return { result, pagination: { totalResults: total, totalPages: Math.ceil(total / limit), currentPage: page, limit } }
}

const userUpcomingBookingService = async (user, option) => {
    const { page, limit } = option;
    const skip = (page - 1) * limit;

    const now = new Date();

    const paymentMatch = [
        {
            paymentMethod: "cash"
        },
        {
            paymentMethod: { $ne: "cash" },
            paymentStatus: "paid"
        }
    ];

    const userObjId = mongoose.Types.ObjectId.isValid(user)
        ? new mongoose.Types.ObjectId(String(user))
        : null;

    const matchStage = {
        user: userObjId ? { $in: [userObjId, String(user)] } : user,
        status: "approved",
        sessionLeft: { $gt: 0 },

        // Future booking only
        date: { $gt: now },

        // Not expired
        expireDate: { $gte: now },

        $or: paymentMatch
    };

    const [result, total] = await Promise.all([
        bookingModel.aggregate([
            {
                $match: matchStage
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            },
            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },
            {
                $unwind: {
                    path: "$serviceData",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "serviceData.user",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            {
                $unwind: {
                    path: "$userData",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    customBookingId: "$bookingId",
                    image: "$serviceData.image",
                    serviceName: "$serviceData.name",
                    serviceId: "$serviceData._id",

                    providerName: "$userData.fullName",

                    sessionLeft: 1,
                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    expireDate: 1,
                    createdAt: 1
                }
            }
        ]),

        bookingModel.countDocuments(matchStage)
    ]);

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};


const allUpcomingBookingService = async (user, option) => {

    const { page, limit, search, isOneTime } = option;

    const skip = (page - 1) * limit;

    const now = new Date();

    const matchStage = {
        provider: new mongoose.Types.ObjectId(String(user)),
        status: "approved",

        // Booking has not started yet
        date: { $gt: now },

        // Booking must not already be expired
        expireDate: { $gt: now }
    };

    if (isOneTime !== undefined) {
        matchStage.isOneTime = isOneTime === "true";
    }

    let searchMatch = {};

    if (search) {
        searchMatch = {
            $or: [
                {
                    "serviceData.name": {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    "userData.fullName": {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    phoneNumberString: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    "assignedToData.name": {
                        $regex: search,
                        $options: "i"
                    }
                }
            ]
        };
    }

    const pipeline = [

        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },

        {
            $unwind: {
                path: "$serviceData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },

        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "staffs",
                localField: "assignedTo",
                foreignField: "_id",
                as: "assignedToData"
            }
        },

        {
            $unwind: {
                path: "$assignedToData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $addFields: {
                phoneNumberString: {
                    $toString: "$userData.phoneNumber"
                }
            }
        },

        ...(search ? [{ $match: searchMatch }] : []),

        {
            $sort: {
                date: 1
            }
        },

        { $skip: skip },
        { $limit: limit },

        {
            $project: {
                customBookingId: "$bookingId",
                name: "$serviceData.image",

                serviceName: "$serviceData.name",
                serviceId: "$serviceData._id",

                userName: "$userData.fullName",
                userImage: "$userData.image",

                number: "$userData.number",
                countryCode: "$userData.countryCode",

                assignedStaff: "$assignedToData.name",

                isOneTime: 1,

                date: 1,
                startTime: 1,
                endTime: 1,
                expireDate: 1,

                createdAt: 1
            }
        }
    ];

    const countPipeline = [

        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },

        {
            $unwind: {
                path: "$serviceData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },

        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "staffs",
                localField: "assignedTo",
                foreignField: "_id",
                as: "assignedToData"
            }
        },

        {
            $unwind: {
                path: "$assignedToData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $addFields: {
                phoneNumberString: {
                    $toString: "$userData.phoneNumber"
                }
            }
        },

        ...(search ? [{ $match: searchMatch }] : []),

        {
            $count: "total"
        }
    ];

    const [result, totalCount] = await Promise.all([
        bookingModel.aggregate(pipeline),
        bookingModel.aggregate(countPipeline)
    ]);

    const total = totalCount[0]?.total || 0;

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};


const allBookingService = async (option) => {
    const { page, limit, search, isOneTime, status } = option;
    const skip = (page - 1) * limit;

    const matchStage = {
        $or: [
            { paymentStatus: "paid" }, // digital payments
            {
                paymentMethod: "cash",
                paymentStatus: "pending"
            } // cash bookings
        ]
    };
    if (status) {
        matchStage.status = status
    }

    if (isOneTime !== undefined) {
        matchStage.isOneTime = isOneTime === "true";
    }

    let searchMatch = {};

    if (search) {
        searchMatch = {
            $or: [
                { "userData.phoneNumber": { $regex: search, $options: "i" } },
                { "userData.fullName": { $regex: search, $options: "i" } },
                { "providerData.fullName": { $regex: search, $options: "i" } },
                { "serviceData.name": { $regex: search, $options: "i" } }
            ]
        };
    }

    const pipeline = [

        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },
        { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "users",
                localField: "serviceData.user",
                foreignField: "_id",
                as: "providerData"
            }
        },
        {
            $unwind: { path: "$providerData", preserveNullAndEmptyArrays: true }
        },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },
        { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

        ...(search ? [{ $match: searchMatch }] : []),

        { $sort: { createdAt: -1 } },

        { $skip: skip },
        { $limit: limit },

        {
            $project: {
                customBookingId: "$bookingId",
                serviceName: "$serviceData.name",
                serviceId: "$serviceData._id",
                userName: "$userData.fullName",
                userImage: "$serviceData.image",
                number: "$userData.number",
                countryCode: "$userData.countryCode",
                providerName: "$providerData.fullName",
                totalPrice: 1,
                paymentMethod: 1,
                isOneTime: 1,
                status: 1,
                createdAt: 1
            }
        }
    ];

    const [result, totalCount] = await Promise.all([
        bookingModel.aggregate(pipeline),

        bookingModel.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },
            { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

            ...(search ? [{ $match: searchMatch }] : []),

            { $count: "total" }
        ])
    ]);

    const total = totalCount[0]?.total || 0;

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};


const allActiveBookingService = async (user, option) => {

    const { page, limit, search, isOneTime } = option;

    const skip = (page - 1) * limit;

    const now = new Date();

    const matchStage = {
        provider: new mongoose.Types.ObjectId(String(user)),
        status: "approved",

        // Booking has actually started
        date: { $lte: now },

        // Booking is still active
        expireDate: { $gt: now }
    };

    if (isOneTime !== undefined) {
        matchStage.isOneTime = isOneTime === "true";
    }

    let searchMatch = {};

    if (search) {
        searchMatch = {
            $or: [
                {
                    "serviceData.name": {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    "userData.fullName": {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    phoneNumberString: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    "assignedToData.name": {
                        $regex: search,
                        $options: "i"
                    }
                }
            ]
        };
    }

    const pipeline = [

        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },

        {
            $unwind: {
                path: "$serviceData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },

        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "staffs",
                localField: "assignedTo",
                foreignField: "_id",
                as: "assignedToData"
            }
        },

        {
            $unwind: {
                path: "$assignedToData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $addFields: {
                phoneNumberString: {
                    $toString: "$userData.phoneNumber"
                }
            }
        },

        ...(search ? [{ $match: searchMatch }] : []),

        {
            $sort: {
                expireDate: 1
            }
        },

        { $skip: skip },
        { $limit: limit },

        {
            $project: {
                customBookingId: "$bookingId",
                name: "$serviceData.image",

                serviceName: "$serviceData.name",
                serviceId: "$serviceData._id",

                userName: "$userData.fullName",
                userImage: "$userData.image",

                number: "$userData.number",
                countryCode: "$userData.countryCode",

                assignedStaff: "$assignedToData.name",

                isOneTime: 1,

                date: 1,
                startTime: 1,
                endTime: 1,
                expireDate: 1,

                checkin: 1,
                createdAt: 1
            }
        }
    ];

    const countPipeline = [

        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },

        {
            $unwind: {
                path: "$serviceData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },

        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "staffs",
                localField: "assignedTo",
                foreignField: "_id",
                as: "assignedToData"
            }
        },

        {
            $unwind: {
                path: "$assignedToData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $addFields: {
                phoneNumberString: {
                    $toString: "$userData.phoneNumber"
                }
            }
        },

        ...(search ? [{ $match: searchMatch }] : []),

        {
            $count: "total"
        }
    ];

    const [result, totalCount] = await Promise.all([
        bookingModel.aggregate(pipeline),
        bookingModel.aggregate(countPipeline)
    ]);

    const total = totalCount[0]?.total || 0;

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};



const allDueBookingService = async (user, option) => {

    const { page, limit, search, isOneTime } = option;

    const skip = (page - 1) * limit;
    const now = new Date();

    const matchStage = {
        provider: new mongoose.Types.ObjectId(String(user)),
        status: "approved",

        // Expired approved bookings
        expireDate: { $lte: now }
    };

    if (isOneTime !== undefined) {
        matchStage.isOneTime = isOneTime === "true";
    }

    // নিচের pipeline তোমার allActiveBookingService-এর মতোই থাকবে
    // শুধু matchStage এবং sorting পরিবর্তন করবে।

    const pipeline = [
        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },

        {
            $unwind: {
                path: "$serviceData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },

        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "staffs",
                localField: "assignedTo",
                foreignField: "_id",
                as: "assignedToData"
            }
        },

        {
            $unwind: {
                path: "$assignedToData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $addFields: {
                phoneNumberString: {
                    $toString: "$userData.phoneNumber"
                }
            }
        },

        ...(search
            ? [{
                $match: {
                    $or: [
                        {
                            "serviceData.name": {
                                $regex: search,
                                $options: "i"
                            }
                        },
                        {
                            "userData.fullName": {
                                $regex: search,
                                $options: "i"
                            }
                        },
                        {
                            phoneNumberString: {
                                $regex: search,
                                $options: "i"
                            }
                        },
                        {
                            "assignedToData.name": {
                                $regex: search,
                                $options: "i"
                            }
                        }
                    ]
                }
            }]
            : []),

        {
            $sort: {
                expireDate: -1
            }
        },

        { $skip: skip },
        { $limit: limit },

        {
            $project: {
                name: "$serviceData.image",

                serviceName: "$serviceData.name",
                serviceId: "$serviceData._id",

                userName: "$userData.fullName",
                userImage: "$userData.image",

                number: "$userData.number",
                countryCode: "$userData.countryCode",

                assignedStaff: "$assignedToData.name",

                isOneTime: 1,

                date: 1,
                startTime: 1,
                endTime: 1,
                expireDate: 1,

                checkin: 1,
                createdAt: 1
            }
        }
    ];

    const countPipeline = [
        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },

        {
            $unwind: {
                path: "$serviceData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },

        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "staffs",
                localField: "assignedTo",
                foreignField: "_id",
                as: "assignedToData"
            }
        },

        {
            $unwind: {
                path: "$assignedToData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $addFields: {
                phoneNumberString: {
                    $toString: "$userData.phoneNumber"
                }
            }
        },

        ...(search
            ? [{
                $match: {
                    $or: [
                        {
                            "serviceData.name": {
                                $regex: search,
                                $options: "i"
                            }
                        },
                        {
                            "userData.fullName": {
                                $regex: search,
                                $options: "i"
                            }
                        },
                        {
                            phoneNumberString: {
                                $regex: search,
                                $options: "i"
                            }
                        },
                        {
                            "assignedToData.name": {
                                $regex: search,
                                $options: "i"
                            }
                        }
                    ]
                }
            }]
            : []),

        {
            $count: "total"
        }
    ];

    const [result, totalCount] = await Promise.all([
        bookingModel.aggregate(pipeline),
        bookingModel.aggregate(countPipeline)
    ]);

    const total = totalCount[0]?.total || 0;

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};

const allCompletedBookingService = async (user, option) => {

    const { page = 1, limit = 10, search, isOneTime } = option;

    const skip = (page - 1) * limit;
    const now = new Date();

    // const matchStage = {
    //     provider: new mongoose.Types.ObjectId(String(user)),
    //     status: "completed",
    //     paymentStatus: "paid",
    // };
    const matchStage = {
        provider: new mongoose.Types.ObjectId(String(user)),
        status: "completed",
        $or: [
            // cash bookings allowed even if pending
            { paymentMethod: "cash", paymentStatus: "pending" },

            // all other methods must be paid
            {
                paymentMethod: { $ne: "cash" },
                paymentStatus: "paid"
            }
        ]
    };

    if (isOneTime !== undefined) {
        matchStage.isOneTime = isOneTime === "true";
    }

    let searchMatch = {};

    if (search) {
        searchMatch = {
            $or: [
                { "serviceData.name": { $regex: search, $options: "i" } },
                { "userData.fullName": { $regex: search, $options: "i" } },
                { phoneNumberString: { $regex: search, $options: "i" } },
                { "assignedToData.fullName": { $regex: search, $options: "i" } }
            ]
        };
    }

    const pipeline = [

        { $match: matchStage },
        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },
        { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },
        { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "staffs",
                localField: "assignedTo",
                foreignField: "_id",
                as: "assignedToData"
            }
        },
        { $unwind: { path: "$assignedToData", preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                phoneNumberString: { $toString: "$userData.phoneNumber" }
            }
        },
        ...(search ? [{ $match: searchMatch }] : []),

        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
            $project: {
                customBookingId: "$bookingId",
                serviceName: "$serviceData.name",
                serviceId: "$serviceData._id",
                userName: "$userData.fullName",
                userImage: "$userData.image",
                phoneNumber: "$userData.phoneNumber",
                assignedStaff: "$assignedToData.name",
                isOneTime: 1,
                date: 1,
                startTime: 1,
                endTime: 1,
                checkin: 1,
                createdAt: 1,
                review: 1,
                rating: 1
            }
        }
    ];

    const [result, totalCount] = await Promise.all([

        bookingModel.aggregate(pipeline),

        bookingModel.aggregate([
            { $match: matchStage },

            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },
            { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

            {
                $lookup: {
                    from: "users",
                    localField: "assignedTo",
                    foreignField: "_id",
                    as: "assignedToData"
                }
            },
            { $unwind: { path: "$assignedToData", preserveNullAndEmptyArrays: true } },

            {
                $addFields: {
                    phoneNumberString: { $toString: "$userData.phoneNumber" }
                }
            },

            ...(search ? [{ $match: searchMatch }] : []),

            { $count: "total" }
        ])
    ]);

    const total = totalCount[0]?.total || 0;

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};


const allCancelledBookingService = async (user, option) => {
    // console.log({ user, option })
    const { page, limit, search, paymentMethod } = option;

    const skip = (page - 1) * limit;

    const matchStage = {
        provider: new mongoose.Types.ObjectId(String(user)),
        status: "cancelled"
    };

    //  payment method filter
    if (paymentMethod) {
        matchStage.paymentMethod = paymentMethod;
    }

    let searchMatch = {};

    if (search) {
        searchMatch = {
            $or: [
                { "serviceData.name": { $regex: search, $options: "i" } },
                { "userData.fullName": { $regex: search, $options: "i" } },
                { phoneNumberString: { $regex: search, $options: "i" } }
            ]
        };
    }

    const pipeline = [
        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },
        { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },
        { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },

        {
            $lookup: {
                from: "staffs",
                localField: "assignedTo",
                foreignField: "_id",
                as: "assignedToData"
            }
        },
        { $unwind: { path: "$assignedToData", preserveNullAndEmptyArrays: true } },
        {
            $addFields: {
                phoneNumberString: { $toString: "$userData.phoneNumber" }
            }
        },

        ...(search ? [{ $match: searchMatch }] : []),

        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },

        {
            $project: {
                customBookingId: "$bookingId",
                image: "$serviceData.image",
                serviceName: "$serviceData.name",
                serviceId: "$serviceData._id",
                userName: "$userData.fullName",
                phoneNumber: "$userData.phoneNumber",
                assignedStaff: "$assignedToData.name",
                paymentMethod: 1,
                date: 1,
                startTime: 1,
                endTime: 1,
                addons: 1,
                updatedAt: 1
            }
        }
    ];

    const [result, totalCount] = await Promise.all([
        bookingModel.aggregate(pipeline),

        bookingModel.aggregate([
            { $match: matchStage },

            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },
            { $unwind: "$serviceData" },

            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userData"
                }
            },
            { $unwind: "$userData" },

            {
                $addFields: {
                    phoneNumberString: { $toString: "$userData.phoneNumber" }
                }
            },

            ...(search ? [{ $match: searchMatch }] : []),

            { $count: "total" }
        ])
    ]);

    const total = totalCount[0]?.total || 0;

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};



const userActiveBookingService = async (user, option) => {

    const { page, limit } = option;

    const skip = (page - 1) * limit;

    const now = new Date();

    const paymentMatch = [
        {
            paymentMethod: "cash",
            paymentStatus: "pending"
        },
        {
            paymentMethod: { $ne: "cash" },
            paymentStatus: "paid"
        }
    ];

    const userObjId = mongoose.Types.ObjectId.isValid(user)
        ? new mongoose.Types.ObjectId(String(user))
        : null;

    const matchStage = {
        user: userObjId ? { $in: [userObjId, String(user)] } : user,
        status: "approved",
        sessionLeft: { $gt: 0 },

        // Booking has started
        date: { $lte: now },

        // Booking has not expired
        expireDate: { $gte: now },

        $or: paymentMatch
    };

    const [result, total] = await Promise.all([

        bookingModel.aggregate([
            {
                $match: matchStage
            },

            {
                $sort: {
                    createdAt: -1
                }
            },

            {
                $skip: skip
            },

            {
                $limit: limit
            },

            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },

            {
                $unwind: {
                    path: "$serviceData",
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $lookup: {
                    from: "users",
                    localField: "serviceData.user",
                    foreignField: "_id",
                    as: "userData"
                }
            },

            {
                $unwind: {
                    path: "$userData",
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $project: {
                    customBookingId: "$bookingId",
                    image: "$serviceData.image",

                    name: "$serviceData.image",
                    serviceName: "$serviceData.name",
                    serviceId: "$serviceData._id",

                    providerName: "$userData.fullName",

                    sessionLeft: 1,

                    date: 1,
                    startTime: 1,
                    endTime: 1,
                    expireDate: 1,

                    createdAt: 1
                }
            }
        ]),

        bookingModel.countDocuments(matchStage)
    ]);

    return {
        result,

        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};


const userPastBookingService = async (user, option) => {
    console.log(user, "user");

    const { page, limit } = option;

    const skip = (page - 1) * limit;

    const now = new Date();

    const paymentMatch = [
        {
            paymentMethod: "cash"
        },
        {
            paymentMethod: { $ne: "cash" },
            paymentStatus: "paid"
        }
    ];

    const userObjId = mongoose.Types.ObjectId.isValid(user)
        ? new mongoose.Types.ObjectId(String(user))
        : null;

    const matchStage = {
        user: userObjId ? { $in: [userObjId, String(user)] } : user,

        $or: [
            {
                status: "cancelled"
            },
            {
                status: "completed",
                $or: paymentMatch
            },
            {
                status: "approved",
                expireDate: { $lt: now },
                $or: paymentMatch
            }
        ]
    };

    const [result, total] = await Promise.all([

        bookingModel.aggregate([

            {
                $match: matchStage
            },

            {
                $sort: {
                    updatedAt: -1
                }
            },

            {
                $skip: skip
            },

            {
                $limit: limit
            },

            {
                $lookup: {
                    from: "services",
                    localField: "service",
                    foreignField: "_id",
                    as: "serviceData"
                }
            },

            {
                $unwind: {
                    path: "$serviceData",
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $lookup: {
                    from: "users",
                    localField: "serviceData.user",
                    foreignField: "_id",
                    as: "userData"
                }
            },

            {
                $unwind: {
                    path: "$userData",
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $lookup: {
                    from: "users",
                    localField: "provider",
                    foreignField: "_id",
                    as: "providerData"
                }
            },

            {
                $unwind: {
                    path: "$providerData",
                    preserveNullAndEmptyArrays: true
                }
            },

            {
                $project: {
                    customBookingId: "$bookingId",
                    image: 1,
                    name: "$serviceData.image",

                    serviceName: "$serviceData.name",
                    serviceId: "$serviceData._id",

                    providerName: { $ifNull: ["$userData.fullName", "$providerData.fullName", ""] },

                    sessionLeft: 1,

                    date: 1,
                    status: 1,
                    reason: 1,

                    startTime: 1,
                    endTime: 1,

                    expireDate: 1,

                    createdAt: 1,
                    updatedAt: 1
                }
            }
        ]),

        bookingModel.countDocuments(matchStage)
    ]);

    return {
        result,

        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};


const allPendingBookingService = async (user, option) => {

    const { page, limit, search, isOneTime } = option;

    const skip = (page - 1) * limit;
    const now = new Date();

    const matchStage = {
        provider: new mongoose.Types.ObjectId(String(user)),
        status: "pending",

        // Do not show expired pending bookings
        expireDate: { $gt: now },

        $or: [
            {
                paymentStatus: "paid"
            },
            {
                paymentMethod: "cash",
                paymentStatus: "pending"
            }
        ]
    };

    if (isOneTime !== undefined) {
        matchStage.isOneTime = isOneTime === "true";
    }

    let searchMatch = {};

    if (search) {
        searchMatch = {
            $or: [
                {
                    "userData.number": {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    "userData.fullName": {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    "serviceData.name": {
                        $regex: search,
                        $options: "i"
                    }
                }
            ]
        };
    }

    const pipeline = [

        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },

        {
            $unwind: {
                path: "$serviceData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },

        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true
            }
        },

        ...(search ? [{ $match: searchMatch }] : []),

        {
            $sort: {
                createdAt: -1
            }
        },

        { $skip: skip },
        { $limit: limit },

        {
            $project: {
                customBookingId: "$bookingId",
                serviceName: "$serviceData.name",
                serviceId: "$serviceData._id",

                userName: "$userData.fullName",
                userImage: "$userData.image",

                number: "$userData.number",
                countryCode: "$userData.countryCode",

                date: 1,
                startTime: 1,
                endTime: 1,
                expireDate: 1,

                isOneTime: 1,
                createdAt: 1
            }
        }
    ];

    const countPipeline = [

        { $match: matchStage },

        {
            $lookup: {
                from: "services",
                localField: "service",
                foreignField: "_id",
                as: "serviceData"
            }
        },

        {
            $unwind: {
                path: "$serviceData",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userData"
            }
        },

        {
            $unwind: {
                path: "$userData",
                preserveNullAndEmptyArrays: true
            }
        },

        ...(search ? [{ $match: searchMatch }] : []),

        {
            $count: "total"
        }
    ];

    const [result, totalCount] = await Promise.all([
        bookingModel.aggregate(pipeline),
        bookingModel.aggregate(countPipeline)
    ]);

    const total = totalCount[0]?.total || 0;

    return {
        result,
        pagination: {
            totalResults: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            limit
        }
    };
};

module.exports = {
    bookingService,allPendingBookingService ,
    bookingDetailsService,
    allPendingBookingService,
    bookingFeedbackService,
    allActiveBookingService,
    allCompletedBookingService,
    allCancelledBookingService,
    bookingDetailsAdminEndService,
    approveBookingService,
    completeBookingService,
    allBookingService,
    assignStuffService,
    markAsCompletedService,
    modifyBookingService,
    userPendingBookingService,
    userActiveBookingService,
    userUpcomingBookingService,
    userPastBookingService,
    allUpcomingBookingService,
    allDueBookingService,
    checkPinService,
    cancelBookingService
}
