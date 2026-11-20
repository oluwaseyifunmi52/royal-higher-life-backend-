const AdminAudit = require("../Models/adminAudit");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/apiResponse");

const listAdminAudit = asyncHandler(async (_req, res) => {
    const logs = await AdminAudit.find().populate("actor", "firstName lastName email role").sort({ createdAt: -1 }).limit(100).lean();
    return res.status(200).json(new ApiResponse(200, "Recent administrator activity fetched", logs));
});

module.exports = { listAdminAudit };
