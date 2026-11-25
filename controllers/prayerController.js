const PrayerRequest = require("../Models/prayerRequest");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { submissionIdFromKey, SUBMISSION_KEY_PATTERN } = require("../utils/submissionIdempotency");
const { enqueueSubmissionNotifications, enqueueNotification, resetFailedJob, attachAdminNotificationStatuses } = require("../services/notificationOutbox");

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const CATEGORIES = ["Healing", "Financial Breakthrough", "Family", "Spiritual Growth", "General Prayer"];
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
    } = req.body;

    const fullName = String(name || [firstname, lastname].filter(Boolean).join(" ")).trim();
    const requestText = String(request || prayer || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedCategory = String(category || "General Prayer").trim();
    const submissionKey = String(req.body.submissionKey || req.get?.("Idempotency-Key") || "").trim();

    if (!fullName || !normalizedEmail || !requestText) {
        throw new ApiError(400, "Name, email, and prayer request are required");
    }
    if (fullName.length > 120 || requestText.length < 5 || requestText.length > 10000) {
        throw new ApiError(400, "Please check the length of your name and prayer request");
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) throw new ApiError(400, "A valid email address is required");
    if (!CATEGORIES.includes(normalizedCategory)) throw new ApiError(400, "Select a valid prayer category");
    if (!SUBMISSION_KEY_PATTERN.test(submissionKey)) throw new ApiError(400, "A valid submission key is required. Please refresh the form and try again.");

    const deterministicId = submissionIdFromKey(submissionKey);
    let prayerRequest = await PrayerRequest.findById(deterministicId);
    let isDuplicate = Boolean(prayerRequest);
    if (!prayerRequest) {
        try {
            prayerRequest = await PrayerRequest.create({
                _id: deterministicId,
                name: fullName,
                email: normalizedEmail,
                phone: String(phone || "").trim().slice(0, 40),
                request: requestText,
                category: normalizedCategory,
                isPrivate: true,
                status: "pending",
            });
        } catch (error) {
            if (error?.code !== 11000) throw error;
            prayerRequest = await PrayerRequest.findById(deterministicId);
            if (!prayerRequest) throw error;
            isDuplicate = true;
        }
    }

    await enqueueSubmissionNotifications("prayer", prayerRequest._id);

    const statusCode = isDuplicate ? 200 : 201;
    return res.status(statusCode).json({
        ...new ApiResponse(statusCode, "Your confidential prayer request was received and queued for notification.", {
            reference: prayerRequest.reference,
            status: prayerRequest.status,
            notificationStatus: prayerRequest.notificationStatus || "pending",
        }),
        emailNotificationsSent: false,
        emailNotificationQueued: true,
    });
});

const retryPrayerNotification = asyncHandler(async (req, res) => {
    const prayerRequest = await PrayerRequest.findById(req.params.id);
    if (!prayerRequest) {
        throw new ApiError(404, "Prayer request not found");
    }
    const jobId = await enqueueNotification("prayer-admin", prayerRequest._id);
    const reset = await resetFailedJob("prayer-admin", prayerRequest._id);
    if (!reset) {
        const job = await require("../Models/notificationJob").findById(jobId).lean();
        if (job?.status === "sent") throw new ApiError(409, "The notification was already accepted by the provider");
        if (job?.status === "processing") throw new ApiError(409, "A notification attempt is already in progress");
    }
    prayerRequest.notificationStatus = "pending";
    prayerRequest.notificationFailure = "";
    await prayerRequest.save();
    return res.status(202).json(new ApiResponse(202, "The confidential request notification was queued for retry.", {
        reference: prayerRequest.reference, notificationStatus: "pending", notificationJobId: jobId,
    }));
});

const getAllPrayerRequests = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.category && CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
    if (["pending", "received", "praying", "completed"].includes(req.query.status)) filter.status = req.query.status;
    const prayerRequests = await PrayerRequest.find(filter).sort({ createdAt: -1 });
    const visibleRequests = await attachAdminNotificationStatuses("prayer", prayerRequests);
    return res.status(200).json(new ApiResponse(200, "Prayer requests fetched successfully", visibleRequests));
});

const getPrayerRequestById = asyncHandler(async (req, res) => {
    const prayerRequest = await PrayerRequest.findById(req.params.id);

    if (!prayerRequest) {
        throw new ApiError(404, "Prayer request not found");
    }

    const [visibleRequest] = await attachAdminNotificationStatuses("prayer", [prayerRequest]);
    return res.status(200).json(new ApiResponse(200, "Prayer request fetched successfully", visibleRequest));
});

const updatePrayerRequest = asyncHandler(async (req, res) => {
    const updateData = {};
    if (req.body.status !== undefined) {
        const legacyStatuses = { "in-progress": "praying", prayed: "completed", answered: "completed" };
        const status = legacyStatuses[req.body.status] || req.body.status;
        if (!["pending", "received", "praying", "completed"].includes(status)) {
            throw new ApiError(400, "A valid prayer request status is required");
        }
        updateData.status = status;
        updateData.isAnswered = status === "completed";
    } else if (typeof req.body.isAnswered === "boolean") {
        updateData.isAnswered = req.body.isAnswered;
        updateData.status = req.body.isAnswered ? "completed" : "pending";
    }
    if (req.body.internalNotes !== undefined) {
        const notes = String(req.body.internalNotes).trim();
        if (notes.length > 5000) throw new ApiError(400, "Internal notes must be 5000 characters or fewer");
        updateData.internalNotes = notes;
    }
    if (req.body.category !== undefined) {
        if (!CATEGORIES.includes(req.body.category)) throw new ApiError(400, "Select a valid prayer category");
        updateData.category = req.body.category;
    }

    const prayerRequest = await PrayerRequest.findByIdAndUpdate(req.params.id, updateData, {
        returnDocument: 'after',
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
    retryPrayerNotification,
    getAllPrayerRequests,
    getPrayerRequestById,
    updatePrayerRequest,
    deletePrayerRequest,
};
