const Review = require("../Models/review");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");

const createReview = asyncHandler(async (req, res) => {
    const { name, message, rating } = req.body;

    if (!name || !message || rating === undefined) {
        throw new ApiError(400, "Name, message, and rating are required");
    }

    const review = await Review.create({ name, message, rating });

    return res.status(201).json(new ApiResponse(201, "Review created successfully", review));
});

const getAllReviews = asyncHandler(async (req, res) => {
    const reviews = await Review.find().sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Reviews fetched successfully", reviews));
});

const getReviewById = asyncHandler(async (req, res) => {
    const review = await Review.findById(req.params.id);

    if (!review) {
        throw new ApiError(404, "Review not found");
    }

    return res.status(200).json(new ApiResponse(200, "Review fetched successfully", review));
});

const updateReview = asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!review) {
        throw new ApiError(404, "Review not found");
    }

    return res.status(200).json(new ApiResponse(200, "Review updated successfully", review));
});

const deleteReview = asyncHandler(async (req, res) => {
    const review = await Review.findByIdAndDelete(req.params.id);

    if (!review) {
        throw new ApiError(404, "Review not found");
    }

    return res.status(200).json(new ApiResponse(200, "Review deleted successfully", null));
});

module.exports = {
    createReview,
    getAllReviews,
    getReviewById,
    updateReview,
    deleteReview,
};
