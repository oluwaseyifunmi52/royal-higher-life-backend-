const Review = require("../Models/review");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { sendAdminTestimonyNotification, sendTestimonyConfirmation } = require("../utils/mailer");

const validEmail = (email) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
const deliverySummary = (results) => {
    const sent = results.filter((result) => result.status === "fulfilled" && result.value?.sent).length;
    return { status: sent === results.length ? "sent" : sent ? "partial" : "failed", sent };
};

const createReview = asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const message = String(req.body.message || req.body.comment || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const title = String(req.body.title || "").trim();
    const rating = Number(req.body.rating);
    const publicationConsent = req.body.publicationConsent === true || req.body.publicationConsent === "true";

    if (!name || !message || req.body.rating === undefined) {
        throw new ApiError(400, "Name, message, and rating are required");
    }
    if (name.length > 120 || title.length > 120 || message.length < 10 || message.length > 10000) {
        throw new ApiError(400, "Please check the length of your name, title, and testimony");
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new ApiError(400, "Rating must be a whole number from 1 to 5");
    }
    if (email && !validEmail(email)) throw new ApiError(400, "A valid email address is required");

    // Persist before sending email so provider failures never lose a submission.
    const review = await Review.create({
        name, email: email || undefined, title, message, rating,
        publicationConsent, status: "pending", isApproved: false,
    });
    const submittedAt = review.createdAt.toISOString();
    const notifications = [sendAdminTestimonyNotification({
        id: review.id,
        reference: review.reference,
        name: review.name,
        email: review.email,
        rating: review.rating,
        publicationConsent: review.publicationConsent,
        createdAt: review.createdAt,
    })];
    if (review.email) notifications.push(sendTestimonyConfirmation(
        review.email, review.name, review.reference, review.id, submittedAt
    ));
    const results = await Promise.allSettled(notifications);
    const adminNotification = results[0].status === "fulfilled" ? results[0].value : null;
    const confirmation = email ? results[1]?.status === "fulfilled" ? results[1].value : null : null;
    const summary = deliverySummary(results);
    review.notificationStatus = summary.status;
    review.notificationFailure = summary.status === "sent" ? "" : results
        .map((result) => result.status === "fulfilled" ? result.value?.reason : "provider_error")
        .filter(Boolean).join(",").slice(0, 200);
    review.notificationProviderId = adminNotification?.accepted ? adminNotification.id || "" : "";
    review.confirmationStatus = !email ? "failed" : confirmation?.accepted ? "accepted" : confirmation?.reason === "network_error" || results[1]?.status === "rejected" ? "unknown" : "failed";
    review.notificationAttemptCount = 1;
    review.lastNotificationAttemptAt = new Date();
    await review.save();
    if (summary.status !== "sent") console.warn("Testimony notification delivery was incomplete.", { reference: review.reference, status: summary.status });

    return res.status(201).json({
        ...new ApiResponse(201, "Testimony received and is pending ministry review.", {
            reference: review.reference,
            status: review.status,
            notificationStatus: review.notificationStatus,
        }),
        emailNotificationsSent: summary.status === "sent",
    });
});

const retryTestimonyNotification = asyncHandler(async (req, res) => {
    const review = await Review.findOneAndUpdate(
        { _id: req.params.id, notificationStatus: { $ne: "pending" } },
        { $set: { notificationStatus: "pending", notificationFailure: "" }, $inc: { notificationAttemptCount: 1 } },
        { returnDocument: 'after' }
    );
    if (!review) {
        const exists = await Review.exists({ _id: req.params.id });
        if (!exists) throw new ApiError(404, "Testimony not found");
        throw new ApiError(409, "A notification attempt is already in progress");
    }
    const result = await sendAdminTestimonyNotification({
        id: review.id, reference: review.reference, name: review.name, email: review.email,
        rating: review.rating, publicationConsent: review.publicationConsent, createdAt: review.createdAt,
    });
    review.notificationStatus = result?.accepted ? "accepted" : result?.reason === "network_error" ? "unknown" : "failed";
    review.notificationProviderId = result?.accepted ? result.id || "" : "";
    review.notificationFailure = result?.accepted ? "" : result?.providerCode || result?.reason || "provider_error";
    review.lastNotificationAttemptAt = new Date();
    await review.save();
    return res.status(200).json(new ApiResponse(200, result?.accepted
        ? "The provider accepted the testimony notification; delivery is not confirmed."
        : "The testimony remains saved, but its notification could not be accepted.", {
        reference: review.reference, notificationStatus: review.notificationStatus,
        notificationProviderId: review.notificationProviderId || null,
        notificationFailure: review.notificationFailure,
    }));
});

const getAllReviews = asyncHandler(async (req, res) => {
    // Public endpoint: return only approved reviews
    const reviews = await Review.find({ isApproved: true, publicationConsent: true })
        .select("name title message rating reference createdAt updatedAt")
        .sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Reviews fetched successfully", reviews));
});

const getAllReviewsAdmin = asyncHandler(async (_req, res) => {
    const reviews = await Review.find().sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "All reviews fetched successfully", reviews));
});

const getReviewById = asyncHandler(async (req, res) => {
    const review = await Review.findById(req.params.id);

    if (!review) {
        throw new ApiError(404, "Review not found");
    }

    // Public endpoint: only return approved reviews
    if (!review.isApproved || !review.publicationConsent) {
        throw new ApiError(404, "Review not found");
    }

    const publicReview = {
        _id: review._id,
        name: review.name,
        title: review.title,
        message: review.message,
        rating: review.rating,
        reference: review.reference,
        createdAt: review.createdAt,
    };
    return res.status(200).json(new ApiResponse(200, "Review fetched successfully", publicReview));
});

const updateReview = asyncHandler(async (req, res) => {
    const current = await Review.findById(req.params.id);
    if (!current) throw new ApiError(404, "Review not found");

    const updates = {};
    for (const field of ["name", "title", "message"]) {
        if (req.body[field] !== undefined) updates[field] = String(req.body[field]).trim();
    }
    if (req.body.rating !== undefined) updates.rating = Number(req.body.rating);
    if (typeof req.body.isApproved === "boolean") updates.isApproved = req.body.isApproved;
    if (["pending", "approved", "rejected"].includes(req.body.status)) updates.status = req.body.status;
    if (updates.status === "approved") updates.isApproved = true;
    if (updates.status === "rejected" || updates.status === "pending") updates.isApproved = false;
    if (updates.isApproved === true && !current.publicationConsent) {
        throw new ApiError(400, "This contributor did not give publication consent. Keep the testimony unpublished until consent is recorded.");
    }
    if (updates.isApproved !== undefined && updates.status === undefined) {
        updates.status = updates.isApproved ? "approved" : "pending";
    }
    const review = await Review.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after', runValidators: true });

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
    retryTestimonyNotification,
    getAllReviews,
    getAllReviewsAdmin,
    getReviewById,
    updateReview,
    deleteReview,
};
