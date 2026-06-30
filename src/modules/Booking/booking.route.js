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
    cancelBookingController} = require("./booking.controller");
const router = express.Router();


router.post("/add", auth(['user']), bookingController);
router.put("/edit/:bookingId", auth(['user']), modifyBookingController);
router.get('/partner/upcoming', auth(['partner']), allPendingBookingController);
router.get('/admin/all-booking', auth(['admin','sub_admin']), allBookingController);
router.get('/partner/active', auth(['partner']), allActiveBookingController);
router.get('/partner/completed', auth(['partner']), allCompletedBookingController);
router.get('/partner/cancelled', auth(['partner']), allCancelledBookingController);
router.get('/partner/details/:id', auth(['partner']), bookingDetailsAdminEndController);
router.get('/upcoming-userend', auth(['user']), pendingBookingController);
router.get('/active-userend', auth(['user']), activeBookingController);
router.get('/past-userend', auth(['user']), pastBookingController);
router.get('/details-userend/:id', auth(['user']), bookingDetailsController);
router.get('/details/:id', auth(['user']), bookingDetailsController);
router.patch('/mark-completed/:id', auth(['partner']), markAsCompletedController);
router.post('/feedback/:id', auth(['user', 'partner']), bookingFeedbackController);
router.patch('/partner/approve/:id', auth(['partner']), approveBookingController);
router.patch('/partner/cancel/:id', auth(['partner']), cancelBookingController);
router.patch('/partner/complete/:id', auth(['partner']), completeBookingController);
router.patch('/assign-stuff/:id', auth(['partner']), assignStuffController);



module.exports = router;