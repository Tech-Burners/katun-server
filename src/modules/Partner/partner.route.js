const express = require('express');
const { pendingPartnerForApproval, detailsForAdminController, allPartnerController,
    suspendPartnerController, activePartnerController, giveFlagController,
    giveNoteController, rejectProviderController, approvePartnerController,
    partnerFeedbackController, aPartnerDetailsController, partnerDashboardController } = require('./partner.controller');
const { auth } = require('../../middlewares/auth');
const router = express.Router();



router.get('/admin/details/:id', detailsForAdminController);
router.get('/details/:id', auth(['user'], { optional: true }), aPartnerDetailsController);
router.get('/pending-forApproval', pendingPartnerForApproval);
router.get('/all', allPartnerController);
router.get('/dashboard', auth(['partner']), partnerDashboardController);
router.post('/feedback/:partnerId', partnerFeedbackController);
router.patch('/suspend/:id', auth(['admin']), suspendPartnerController);
router.patch('/active/:id', auth(['admin']), activePartnerController);
router.patch('/approve/:id', auth(['admin']), approvePartnerController);
router.patch('/give-flag/:id', auth(['admin']), giveFlagController);
router.patch('/give-note/:id', auth(['admin']), giveNoteController);
router.patch('/reject/:id', auth(['admin']), rejectProviderController);


module.exports = router;
