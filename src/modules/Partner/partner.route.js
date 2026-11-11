const express = require('express');
const { pendingPartnerForApproval, detailsForAdminController, allPartnerController,
    suspendPartnerController, activePartnerController, giveFlagController,
    giveNoteController, rejectProviderController, approvePartnerController,
    partnerFeedbackController, aPartnerDetailsController, partnerDashboardController, 
    bulkSuspendPartnerController,
    bulkActivePartnerController,
    bulkApprovePartnerController,
    bulkGiveFlagController,
    bulkGiveNoteController,
    bulkRejectProviderController} = require('./partner.controller');
const { getCouponsByPartnerController } = require('../Promo/promo.controller');
const { auth } = require('../../middlewares/auth');
const router = express.Router();



router.get('/admin/details/:id', detailsForAdminController);
router.get('/details/:id', auth(['user'], { optional: true }), aPartnerDetailsController);
router.get('/:partnerId/coupons', auth(['user', 'partner', 'admin', 'sub_admin'], { optional: true }), getCouponsByPartnerController);
router.get('/:partnerId/promos', auth(['user', 'partner', 'admin', 'sub_admin'], { optional: true }), getCouponsByPartnerController);
router.get('/pending-forApproval', pendingPartnerForApproval);
router.get('/all', allPartnerController);
router.get('/dashboard', auth(['partner']), partnerDashboardController);
router.post('/feedback/:partnerId', partnerFeedbackController);
router.patch('/suspend/:id', auth(['admin', 'sub_admin']), suspendPartnerController);
router.patch("/bulk-suspend",auth(['admin', 'sub_admin']),bulkSuspendPartnerController);
router.patch('/active/:id', auth(['admin', 'sub_admin']), activePartnerController);
router.patch(
  "/bulk-active",
  auth(['admin', 'sub_admin']),
  bulkActivePartnerController
);
router.patch('/approve/:id', auth(['admin', 'sub_admin']), approvePartnerController);
router.patch(
  "/bulk-approve",
  auth(['admin', 'sub_admin']),
  bulkApprovePartnerController
);
router.patch('/give-flag/:id', auth(['admin', 'sub_admin']), giveFlagController);
router.patch(
  "/bulk-flag",
  auth(['admin', 'sub_admin']),
  bulkGiveFlagController
);
router.patch('/give-note/:id', auth(['admin', 'sub_admin']), giveNoteController);
router.patch(
  "/bulk-note",
  auth(['admin', 'sub_admin']),
  bulkGiveNoteController
);
router.patch('/reject/:id', auth(['admin', 'sub_admin']), rejectProviderController);
router.patch(
  "/bulk-reject",
  auth(['admin', 'sub_admin']),
  bulkRejectProviderController
);

module.exports = router;
