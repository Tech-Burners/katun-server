const express = require('express');
const { auth } = require('../../middlewares/auth')
const { addAdminController, allAdminController, editAdminController, deleteAdminController, suspendAdminController, activateAdminController, allAdminWithMainAdminController } = require('./admin.controller');
const router = express.Router();

router.post('/add', auth(['admin', 'hr']), addAdminController);
router.put('/edit/:userId', auth(['admin', 'sub-admin', 'hr']), editAdminController);
router.get('/all', auth(['admin', 'sub-admin', 'hr']), allAdminController);
router.get('/allwithMainAdmin', auth(['admin', 'sub-admin', 'hr']), allAdminWithMainAdminController);
router.delete('/:userId', auth(['admin', 'sub-admin', 'hr']), deleteAdminController);
router.patch('/suspend/:userId', auth(['admin', 'sub-admin', 'hr']), suspendAdminController);
router.patch('/activate/:userId', auth(['admin', 'sub-admin', 'hr']), activateAdminController);

module.exports = router;

