const Ministry = require("../Models/ministry");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

const createMinistry = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    if (!name || !description) {
        throw new ApiError(400, "Name and description are required");
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const ministry = await Ministry.create({ ...req.body, slug });

    res.status(201).json(new ApiResponse(201, "Ministry created successfully", ministry));
});

const getMinistries = asyncHandler(async (req, res) => {
    const ministries = await Ministry.find().sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, "Ministries fetched successfully", ministries));
});

const getMinistry = asyncHandler(async (req, res) => {
    const ministry = await Ministry.findById(req.params.id);

    if (!ministry) {
        throw new ApiError(404, "Ministry not found");
    }

    res.status(200).json(new ApiResponse(200, "Ministry fetched successfully", ministry));
});

const updateMinistry = asyncHandler(async (req, res) => {
    const ministry = await Ministry.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    if (!ministry) {
        throw new ApiError(404, "Ministry not found");
    }

    res.status(200).json(new ApiResponse(200, "Ministry updated successfully", ministry));
});

const deleteMinistry = asyncHandler(async (req, res) => {
    const ministry = await Ministry.findByIdAndDelete(req.params.id);

    if (!ministry) {
        throw new ApiError(404, "Ministry not found");
    }

    res.status(200).json(new ApiResponse(200, "Ministry deleted successfully", null));
});

module.exports = {
    createMinistry,
    getMinistries,
    getMinistry,
    updateMinistry,
    deleteMinistry,
};
