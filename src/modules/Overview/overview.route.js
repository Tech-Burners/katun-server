const express = require('express');
const { auth } = require('../../middlewares/auth');
const { getCountCards, userRatio, getCategoryServiceCount, getPending, getHrCard, getHrCreditSpentTrendController, getPartnerCount, getPartnerBookingTrendController, getPartnerEarningOverviewController, getUserWalletAndTransactionsController, creditWalletController } = require('./overview.controller');
const router = express.Router();

router.get('/admin/count-cards', auth(['admin']), getCountCards);
router.get('/admin/pending-stats', auth(['admin']), getPending);
router.get('/user-ratio', auth(['admin']), userRatio);
router.get('/category-service-ratio', auth(['admin', 'hr']), getCategoryServiceCount);
router.get('/partner/count', auth(['partner']), getPartnerCount);
router.get('/partner/booking-trend', auth(['partner']), getPartnerBookingTrendController);
router.get('/partner/earning-overview', auth(['partner']), getPartnerEarningOverviewController);
router.get('/user/wallet-transactions', auth(['user']), getUserWalletAndTransactionsController);
router.get('/hr/card', auth(['hr']), getHrCard);
router.get('/hr/credit-wallet', auth(['hr']), creditWalletController);
router.get('/hr/credit-spent-trend', auth(['hr']), getHrCreditSpentTrendController);


module.exports = router;