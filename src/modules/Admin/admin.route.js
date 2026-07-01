const express = require('express');
const { auth } = require('../../middlewares/auth')
const { addAdminController, allAdminController, editAdminController, deleteAdminController, suspendAdminController, activateAdminController, allAdminWithMainAdminController } = require('./admin.controller');
const router = express.Router();

router.post('/add', auth(['admin', 'hr']), addAdminController);
router.put('/edit/:userId', auth(['admin', 'sub_admin', 'hr']), editAdminController);
router.get('/all', auth(['admin', 'sub_admin', 'hr']), allAdminController);
router.get('/allwithMainAdmin', auth(['admin', 'sub_admin', 'hr']), allAdminWithMainAdminController);
router.delete('/:userId', auth(['admin', 'sub_admin', 'hr']), deleteAdminController);
router.patch('/suspend/:userId', auth(['admin', 'sub_admin', 'hr']), suspendAdminController);
router.patch('/activate/:userId', auth(['admin', 'sub_admin', 'hr']), activateAdminController);

module.exports = router;

