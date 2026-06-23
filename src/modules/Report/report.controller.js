const catchAsync = require("../../helpers/catchAsync");
const response = require("../../helpers/response");
const { default: status } = require("http-status");
const { getAllReportService, addReportService, readUnreadReportService, reportDetailsService, reportStatusUpdateService, reportCountService } = require("./report.service");
const { search } = require("./report.route");
const { addAuditReport } = require("../Audit/audit.service");


const addReportController = catchAsync(async (req, res) => {
    req.body.reporter = req.User._id;
    const report = await addReportService(req.body);
    return res.status(status.CREATED).json(response({ status: "success", statusCode: status.CREATED, type: "report", message: "report added successfully", data: report }));
});

const reportStatusUpdateController = catchAsync(async (req, res) => {
    const data = await reportStatusUpdateService(req.params.reportId, req.body.status);
    await addAuditReport({
        performedBy: req.User._id,
        summary: `Report status updated to ${req.body.status}`,
        action: `Report`
    })
    return res.status(status.OK).json(response({ status: "success", statusCode: status.OK, type: "report", message: "report read successfully", data }));
})


const reportDetailsController = catchAsync(async (req, res) => {
    const data = await reportDetailsService(req.params.reportId);
    return res.status(status.OK).json(response({ status: "success", statusCode: status.OK, type: "report", message: "report details fetched successfully", data }));
})

const countController = catchAsync(async (req, res) => {
    const count = await reportCountService();
    return res.status(status.OK).json(response({ status: "success", statusCode: status.OK, type: "report", message: "report count fetched successfully", data: { count } }));
})



const getReportController = catchAsync(async (req, res) => {
    const options = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search: req.query.search || "",
        status: req.query.status || "",
    };

    const report = await getAllReportService(options);
    return res.status(status.OK).json(
        response({
            status: "success",
            statusCode: status.OK,
            type: "report",
            message: "report fetched successfully",
            data: report
        })
    );
});



module.exports = { addReportController, getReportController,reportDetailsController, reportStatusUpdateController, countController };