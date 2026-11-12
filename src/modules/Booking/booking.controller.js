const { default: status } = require("http-status");
const { bookingService, pendingBookingService, upcomingBookingService, activeBookingService, pastBookingService, bookingDetailsService, bookingFeedbackService, allPendingBookingService,
    allActiveBookingService,
    allCompletedBookingService,
    allCancelledBookingService,
    bookingDetailsAdminEndService,
    approveBookingService,
    allBookingService,
    completeBookingService,
    assignStuffService,
    markAsCompletedService,
    serviceFeedbackService,
    modifyBookingService,
    cancelBookingService, 
    userPendingBookingService,
    userUpcomingBookingService,
    userActiveBookingService,
    userPastBookingService,
    allUpcomingBookingService,
    allDueBookingService,
    checkPinService} = require("./booking.service")
const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");
const serviceModel = require("../Service/service.model");
const { sendNewBookingNotifications } = require("./bookingExpiry.service");

const bookingController = catchAsync(async (req, res) => {
    req.body.user = req.User._id;
    const result = await bookingService(req.body);
    await sendNewBookingNotifications(result);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Booking", message: "Booking added successfully", data: result, }));
})

const verifyPinController = catchAsync(async (req, res) => {
    const result = await checkPinService(req.params.bookingId, req.body.pin);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Booking", message: "OTP verified successfully, service started", data: result, }));
})

const modifyBookingController = catchAsync(async (req, res) => {
    const result = await modifyBookingService(req.params.bookingId, req.User._id, req.body);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Booking", message: "Booking modified successfully", data: result, }));
})

const userPendingBookingController = catchAsync(async (req, res) => {
    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    }
    const result = await userPendingBookingService(req.User._id, option);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Booking", message: "Pending bookings fetched successfully", data: result, }));
})

const userUpcomingBookingController = catchAsync(async (req, res) => {

    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    };

    const result = await userUpcomingBookingService(
        req.User._id,
        option
    );

    return res.status(status.OK).json(
        response({
            status: "success",
            statusCode: status.OK,
            type: "Booking",
            message: "Upcoming bookings fetched successfully",
            data: result
        })
    );
});

const allUpcomingBookingController = catchAsync(async (req, res) => {

    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search || "",
        isOneTime: req.query.isOneTime
    };

    const result = await allUpcomingBookingService(
        req.User._id,
        option
    );

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            type: "Booking",
            message: "Upcoming bookings fetched successfully",
            data: result
        })
    );
});

const allBookingController = catchAsync(async (req, res) => {
    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search || "",
        isOneTime: req.query.isOneTime,
        status: req.query.status
    };

    const result = await allBookingService(option);

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            type: "Booking",
            message: "Bookings fetched successfully",
            data: result
        })
    );
});


const userActiveBookingController = catchAsync(async (req, res) => {

    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    };

    const result = await userActiveBookingService(
        req.User._id,
        option
    );

    return res.status(status.OK).json(
        response({
            status: "success",
            statusCode: status.OK,
            type: "Booking",
            message: "Active bookings fetched successfully",
            data: result
        })
    );
});

const allActiveBookingController = catchAsync(async (req, res) => {

    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search || "",
        isOneTime: req.query.isOneTime
    };

    const result = await allActiveBookingService(
        req.User._id,
        option
    );

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            type: "Booking",
            message: "Active bookings fetched successfully",
            data: result
        })
    );
});

const allDueBookingController = catchAsync(async (req, res) => {

    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search || "",
        isOneTime: req.query.isOneTime
    };

    const result = await allDueBookingService(
        req.User._id,
        option
    );

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            type: "Booking",
            message: "Due bookings fetched successfully",
            data: result
        })
    );
});


const allCompletedBookingController = catchAsync(async (req, res) => {
    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search || "",
        isOneTime: req.query.isOneTime
    }
    const result = await allCompletedBookingService(req.User._id, option);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Booking", message: "Booking added successfully", data: result, }));
})


const allCancelledBookingController = catchAsync(async (req, res) => {
    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search || "",
        paymentMethod: req.query.paymentMethod || ""
    }
    const result = await allCancelledBookingService(req.User._id, option);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Booking", message: "Booking added successfully", data: result, }));
})


const userPastBookingController = catchAsync(async (req, res) => {
    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10
    }
    const result = await userPastBookingService(req.User._id, option);
    console.log(`[PAST_BOOKING_USEREND] req.User._id=${req.User?._id}, email=${req.User?.email}, found=${result?.pagination?.totalResults}`);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Booking", message: "pasted booking", data: result, }));
})

const bookingDetailsController = catchAsync(async (req, res) => {

    const userId = req.User?._id || null;

    const result = await bookingDetailsService(
        req.params.id,
        userId
    );

    return res.status(status.OK).json(
        response({
            status: "success",
            statusCode: status.OK,
            message: "Booking details fetched successfully",
            data: result
        })
    );
});


const bookingDetailsAdminEndController = catchAsync(async (req, res) => {
    const result = await bookingDetailsAdminEndService(
        req.params.id,
        req.User._id
    );

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            type: "Booking",
            message: "Booking details fetched successfully",
            data: result,
        })
    );
});

// const serviceFeedbackController = catchAsync(async (req, res) => {
//     req.body.user = req.User._id;
//     await serviceFeedbackService(req.body);
//     return res.status(status.CREATED).json(response({
//         status: 'success', statusCode: status.CREATED,
//         type: "Booking",
//         message: "Feedback added successfully"
//     }));
// })

const bookingFeedbackController = catchAsync(async (req, res) => {
    req.body.user = req.User._id;
    await bookingFeedbackService(req.body);
    return res.status(status.CREATED).json(response({
        status: 'success', statusCode: status.CREATED,
        type: "Booking",
        message: "Feedback added successfully"
    }));
})

const markAsCompletedController = catchAsync(async (req, res) => {
    const result = await markAsCompletedService(req.params.id, req.body);
    return res.status(status.OK).json(response({ status: 'success', statusCode: status.OK, type: "Booking", message: "OTP verified successfully, service started", data: result, }));
})


const approveBookingController = catchAsync(async (req, res) => {
    const result = await approveBookingService(req.params.id);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Booking", message: "Booking approved successfully", data: result, }));
})


const cancelBookingController = catchAsync(async (req, res) => {
    const result = await cancelBookingService(req.params.id);
    return res.status(status.OK).json(response({
        status: 'success', statusCode: status.CREATED, type: "Booking",
        message: "Booking cancelled successfully", data: result
    }));
})


const completeBookingController = catchAsync(async (req, res) => {
    const result = await completeBookingService(req.params.id);
    if (result.status == "completed") {
        const service = await serviceModel.findById(result.service)
        service.sell += 1
        service.save();
    }
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Booking", message: "Booking completed successfully", data: result, }));
})

const assignStuffController = catchAsync(async (req, res) => {
    const result = await assignStuffService(req.params.id, req.body.stuff);
    return res.status(status.CREATED).json(response({ status: 'success', statusCode: status.CREATED, type: "Booking", message: "Booking assigned successfully", data: result, }));
})

const allPendingBookingController = catchAsync(async (req, res) => {
    const option = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search || "",
        isOneTime: req.query.isOneTime
    };

    const result = await allPendingBookingService(
        req.User._id,
        option
    );

    return res.status(status.OK).json(
        response({
            status: 'success',
            statusCode: status.OK,
            type: "Booking",
            message: "Pending bookings fetched successfully",
            data: result
        })
    );
});



module.exports = {
    allPendingBookingController ,
    bookingController,
    bookingDetailsController,
    bookingFeedbackController,
    allPendingBookingController,
    allActiveBookingController,
    allCompletedBookingController,
    allCancelledBookingController,
    bookingDetailsAdminEndController,
    completeBookingController,
    approveBookingController,
    allBookingController,
    assignStuffController,
    markAsCompletedController,
    modifyBookingController,
    cancelBookingController,
    // upcomingBookingController,
    userUpcomingBookingController,
    userPendingBookingController,
    userActiveBookingController,
    userPastBookingController,
    allUpcomingBookingController,
    allDueBookingController,
    verifyPinController
}