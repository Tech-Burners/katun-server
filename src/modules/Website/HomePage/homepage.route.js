const express = require('express');
const { updateHomePage, getHomePage } = require('./homepage.controller');
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
    upload.fields([
        { name: "heroImage", maxCount: 1 },
        { name: "serviceIcon", maxCount: 1 }
    ]),
    convertHeicToPng(UPLOADS_FOLDER),
    auth(['admin', 'sub_admin']),
    parseData(), updateHomePage);
router.get('/get', getHomePage);

module.exports = router;