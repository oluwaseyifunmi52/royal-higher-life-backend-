const PrayerRequest = require("../Models/prayerRequest");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

const createPrayerRequest = asyncHandler(async (req, res) => {
    const {
        firstname,
        lastname,
        name,
        email,
        phone,
        prayer,
        request,
        category,
        isPrivate,
        isAnswered,
    } = req.body;

    const fullName = name || [firstname, lastname].filter(Boolean).join(" ").trim();
    const requestText = request || prayer;

    if (!fullName || !requestText) {
        throw new ApiError(400, "Name and prayer request are required");
    }

    const prayerRequest = await PrayerRequest.create({
        name: fullName,
        email,
        phone,
        request: requestText,
        category,
        isPrivate,
        isAnswered,
    });

    return res.status(201).json(new ApiResponse(201, "Prayer request created successfully", prayerRequest));
});

const getAllPrayerRequests = asyncHandler(async (req, res) => {
    const prayerRequests = await PrayerRequest.find().sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Prayer requests fetched successfully", prayerRequests));
});

const getPrayerRequestById = asyncHandler(async (req, res) => {
    const prayerRequest = await PrayerRequest.findById(req.params.id);

    if (!prayerRequest) {
        throw new ApiError(404, "Prayer request not found");
    }

    return res.status(200).json(new ApiResponse(200, "Prayer request fetched successfully", prayerRequest));
});

const updatePrayerRequest = asyncHandler(async (req, res) => {
    const prayerRequest = await PrayerRequest.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!prayerRequest) {
        throw new ApiError(404, "Prayer request not found");
    }

    return res.status(200).json(new ApiResponse(200, "Prayer request updated successfully", prayerRequest));
});

const deletePrayerRequest = asyncHandler(async (req, res) => {
    const prayerRequest = await PrayerRequest.findByIdAndDelete(req.params.id);

    if (!prayerRequest) {
        throw new ApiError(404, "Prayer request not found");
    }

    return res.status(200).json(new ApiResponse(200, "Prayer request deleted successfully", null));
});

module.exports = {
    createPrayerRequest,
    getAllPrayerRequests,
    getPrayerRequestById,
    updatePrayerRequest,
    deletePrayerRequest,
};
