const express = require('express');
const { updatePartnerPage, getPartnerPage } = require('./partner.controller');
const router = express.Router();


const fileUploadMiddleware = require("../../../middlewares/fileUpload");
const UPLOADS_FOLDER = "./public/uploads/web";
const upload = fileUploadMiddleware(UPLOADS_FOLDER);
const convertHeicToPng = require('../../../middlewares/converter');
const ensureUploadFolderExists = require('../../../helpers/fileExists');
const parseData = require('../../../middlewares/parseData');
const { auth } = require('../../../middlewares/auth');
ensureUploadFolderExists(UPLOADS_FOLDER);


router.post('/update',
    upload.any(),
    convertHeicToPng(UPLOADS_FOLDER),
    auth(['admin', 'sub_admin']),
    parseData(),
    updatePartnerPage
);

router.get('/get', getPartnerPage);

module.exports = router;