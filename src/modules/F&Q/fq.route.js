const express = require('express');
const { addFQ, getFQ, editFQ, deleteFQ, getallFQ } = require('./fq.controller');
const { auth } = require('../../middlewares/auth');
const router = express.Router();

router.post('/',auth(['admin']), addFQ);
router.get('/all', getFQ);
router.put('/:id',auth(['admin']), editFQ);
router.delete('/:id',auth(['admin']), deleteFQ);

module.exports = router;