const Partnership = require("../Models/partnership");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

const createPartnership = asyncHandler(async (req, res) => {
    const { name, email, phone, organization, partnershipType, message } = req.body;

    if (!name || !email) {
        throw new ApiError(400, "Name and email are required");
    }

    const partnership = await Partnership.create({
        name,
        email,
        phone,
        organization,
        partnershipType,
        message,
    });

    return res.status(201).json(new ApiResponse(201, "Partnership application submitted", partnership));
});

const getAllPartnerships = asyncHandler(async (req, res) => {
    const partnerships = await Partnership.find().sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Partnerships fetched", partnerships));
});

const updatePartnershipStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!["pending", "approved", "rejected"].includes(status)) {
        throw new ApiError(400, "Invalid status value");
    }

    const partnership = await Partnership.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true }
    );

    if (!partnership) {
        throw new ApiError(404, "Partnership not found");
    }

    return res.status(200).json(new ApiResponse(200, "Partnership status updated", partnership));
});

const deletePartnership = asyncHandler(async (req, res) => {
    const partnership = await Partnership.findByIdAndDelete(req.params.id);

    if (!partnership) {
        throw new ApiError(404, "Partnership not found");
    }

    return res.status(200).json(new ApiResponse(200, "Partnership deleted", null));
});

module.exports = {
    createPartnership,
    getAllPartnerships,
    updatePartnershipStatus,
    deletePartnership,
};
