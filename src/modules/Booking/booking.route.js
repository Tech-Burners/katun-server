const express = require("express");
const { auth } = require("../../middlewares/auth");
const { bookingController,
    pendingBookingController,
    activeBookingController,
    pastBookingController, bookingDetailsController,
    bookingFeedbackController, allPendingBookingController,
    allActiveBookingController, allCompletedBookingController,
    allCancelledBookingController, bookingDetailsAdminEndController,
    approveBookingController, allBookingController, 
    completeBookingController,
    assignStuffController,
    markAsCompletedController,
    serviceFeedbackController,
    modifyBookingController,
    cancelBookingController,
    upcomingBookingController,
    userPendingBookingController,
    userUpcomingBookingController,
    userActiveBookingController,
    userPastBookingController,
    allUpcomingBookingController,
    allDueBookingController,
    verifyPinController} = require("./booking.controller");
const router = express.Router();


router.post("/add", auth(['user']), bookingController);
router.put("/edit/:bookingId", auth(['user']), modifyBookingController);
router.get('/partner/pending',auth(['partner']),allPendingBookingController);
router.get('/partner/due',auth(['partner']),allDueBookingController);
router.get('/partner/upcoming', auth(['partner']), allUpcomingBookingController);
router.get('/admin/all-booking', auth(['admin','sub_admin']), allBookingController);
router.get('/partner/active', auth(['partner']), allActiveBookingController);
router.get('/partner/completed', auth(['partner']), allCompletedBookingController);
router.get('/partner/cancelled', auth(['partner']), allCancelledBookingController);
router.get('/partner/details/:id', auth(['partner']), bookingDetailsAdminEndController);
router.get('/pending-userend', auth(['user']), userPendingBookingController);
router.get('/upcoming-userend', auth(['user']), userUpcomingBookingController);
router.get('/active-userend', auth(['user']), userActiveBookingController);
router.get('/past-userend', auth(['user']), userPastBookingController);
router.get('/details-userend/:id', auth(['user']), bookingDetailsController);
router.get('/details/:id', auth(['user']), bookingDetailsController);
router.patch('/mark-completed/:id', auth(['partner']), markAsCompletedController);
router.post('/feedback/:id', auth(['user', 'partner']), bookingFeedbackController);
router.post("/verify-pin/:bookingId", verifyPinController);
router.patch('/partner/approve/:id', auth(['partner']), approveBookingController);
router.patch('/partner/cancel/:id', auth(['partner']), cancelBookingController);
router.patch('/partner/complete/:id', auth(['partner']), completeBookingController);
router.patch('/assign-stuff/:id', auth(['partner']), assignStuffController);



module.exports = router;