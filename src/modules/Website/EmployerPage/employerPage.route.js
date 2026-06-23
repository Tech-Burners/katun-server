const express = require('express');
const router = express.Router();

const fileUploadMiddleware = require("../../../middlewares/fileUpload");
const UPLOADS_FOLDER = "./public/uploads/web";
const upload = fileUploadMiddleware(UPLOADS_FOLDER);
const convertHeicToPng = require('../../../middlewares/converter');
const ensureUploadFolderExists = require('../../../helpers/fileExists');
const parseData = require('../../../middlewares/parseData');
const { auth } = require('../../../middlewares/auth');
const { updateEmployerPage, getEmployerPage } = require('./employerPage.controller');
ensureUploadFolderExists(UPLOADS_FOLDER);


router.post('/update',
    upload.any(),  // Accept any field name so icon_0, icon_1, etc. work
    convertHeicToPng(UPLOADS_FOLDER),
    auth(['admin']),
    parseData(),
    updateEmployerPage
);
    
router.get('/get', getEmployerPage);

module.exports = router;