const express = require('express');
const { addFQ, getFQ, editFQ, deleteFQ, getallFQ } = require('./fq.controller');
const { auth } = require('../../middlewares/auth');
const router = express.Router();

router.post('/',auth(['admin','sub_admin']), addFQ);
router.get('/all', getFQ);
router.put('/:id',auth(['admin','sub_admin']), editFQ);
router.delete('/:id',auth(['admin', 'sub_admin']), deleteFQ);

module.exports = router;