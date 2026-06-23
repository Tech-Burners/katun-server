const { status } = require('http-status');
const response = require('../../helpers/response');
const catchAsync = require('../../helpers/catchAsync');
const { getAuditLogsService } = require('./audit.service');

const getAuditLogsController = catchAsync(async (req, res) => {

    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search,
        action: req.query.action,
        performedBy: req.query.performedBy,
        month: Number(req.query.month),
        year: Number(req.query.year)
    };

    const result = await getAuditLogsService(options, req.User);

    return res.status(status.OK).json(
        response({
            status: "Success",
            statusCode: status.OK,
            type: "audit",
            message: "audit-logs-found",
            data: result
        })
    );
});


module.exports = { getAuditLogsController };
