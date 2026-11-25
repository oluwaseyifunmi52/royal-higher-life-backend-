const Leadership = require("../Models/leadership");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

const getPublicLeadership = asyncHandler(async (_req, res) => {
    const leaders = await Leadership.find({ isPublished: true }).sort({ isPastor: -1, createdAt: 1 });
    return res.status(200).json(new ApiResponse(200, "Leadership fetched successfully", leaders));
});

const getAllLeadership = asyncHandler(async (_req, res) => {
    const leaders = await Leadership.find().sort({ isPastor: -1, createdAt: 1 });
    return res.status(200).json(new ApiResponse(200, "Leadership records fetched successfully", leaders));
});

const createLeadership = asyncHandler(async (req, res) => {
    const leader = await Leadership.create(req.body);
    return res.status(201).json(new ApiResponse(201, "Leadership member created successfully", leader));
});

const updateLeadership = asyncHandler(async (req, res) => {
    const leader = await Leadership.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
    if (!leader) throw new ApiError(404, "Leadership record not found");
    return res.status(200).json(new ApiResponse(200, "Leadership member updated successfully", leader));
});

const deleteLeadership = asyncHandler(async (req, res) => {
    const leader = await Leadership.findByIdAndDelete(req.params.id);
    if (!leader) throw new ApiError(404, "Leadership record not found");
    return res.status(200).json(new ApiResponse(200, "Leadership member deleted successfully", null));
});

module.exports = { getPublicLeadership, getAllLeadership, createLeadership, updateLeadership, deleteLeadership };
