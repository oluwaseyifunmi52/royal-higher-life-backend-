const PrayerRequest = require("../Models/prayerRequest");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { sendPrayerConfirmation, sendAdminPrayerNotification } = require("../utils/mailer");

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const CATEGORIES = ["Healing", "Financial Breakthrough", "Family", "Spiritual Growth", "General Prayer"];
const summarizeDelivery = (results) => {
    const sent = results.filter((result) => result.status === "fulfilled" && result.value?.sent).length;
    return sent === results.length ? "sent" : sent ? "partial" : "failed";
};

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

    if (!fullName || !normalizedEmail || !requestText) {
        throw new ApiError(400, "Name, email, and prayer request are required");
    }
    if (fullName.length > 120 || requestText.length < 5 || requestText.length > 10000) {
        throw new ApiError(400, "Please check the length of your name and prayer request");
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) throw new ApiError(400, "A valid email address is required");
    if (!CATEGORIES.includes(normalizedCategory)) throw new ApiError(400, "Select a valid prayer category");

    const prayerRequest = await PrayerRequest.create({
        name: fullName,
        email: normalizedEmail,
        phone: String(phone || "").trim().slice(0, 40),
        request: requestText,
        category: normalizedCategory,
        isPrivate: true,
        status: "pending",
    });

    const results = await Promise.allSettled([
        sendAdminPrayerNotification({
            id: prayerRequest.id,
            reference: prayerRequest.reference,
            name: prayerRequest.name,
            category: prayerRequest.category,
            createdAt: prayerRequest.createdAt,
        }),
        sendPrayerConfirmation(prayerRequest.email, fullName, prayerRequest.reference, prayerRequest.id, prayerRequest.createdAt.toISOString()),
    ]);
    const adminNotification = results[0].status === "fulfilled" ? results[0].value : null;
    const confirmation = results[1].status === "fulfilled" ? results[1].value : null;
    prayerRequest.notificationStatus = summarizeDelivery(results);
    prayerRequest.notificationFailure = prayerRequest.notificationStatus === "sent" ? "" : results
        .map((result) => result.status === "fulfilled" ? result.value?.reason : "provider_error")
        .filter(Boolean).join(",").slice(0, 200);
    prayerRequest.notificationProviderId = adminNotification?.accepted ? adminNotification.id || "" : "";
    prayerRequest.confirmationStatus = confirmation?.accepted ? "accepted" : confirmation?.reason === "network_error" || results[1].status === "rejected" ? "unknown" : "failed";
    prayerRequest.notificationAttemptCount = 1;
    prayerRequest.lastNotificationAttemptAt = new Date();
    await prayerRequest.save();
    if (prayerRequest.notificationStatus !== "sent") {
        console.warn("Prayer notification delivery was incomplete.", { reference: prayerRequest.reference, status: prayerRequest.notificationStatus });
    }

    return res.status(201).json({
        ...new ApiResponse(201, "Your confidential prayer request was received.", {
            reference: prayerRequest.reference,
            status: prayerRequest.status,
            notificationStatus: prayerRequest.notificationStatus,
        }),
        emailNotificationsSent: prayerRequest.notificationStatus === "sent",
    });
});

const retryPrayerNotification = asyncHandler(async (req, res) => {
    const prayerRequest = await PrayerRequest.findOneAndUpdate(
        { _id: req.params.id, notificationStatus: { $ne: "pending" } },
        { $set: { notificationStatus: "pending", notificationFailure: "" }, $inc: { notificationAttemptCount: 1 } },
        { new: true }
    );
    if (!prayerRequest) {
        const exists = await PrayerRequest.exists({ _id: req.params.id });
        if (!exists) throw new ApiError(404, "Prayer request not found");
        throw new ApiError(409, "A notification attempt is already in progress");
    }
    const result = await sendAdminPrayerNotification({
        id: prayerRequest.id, reference: prayerRequest.reference, name: prayerRequest.name,
        category: prayerRequest.category, createdAt: prayerRequest.createdAt,
    });
    prayerRequest.notificationStatus = result?.accepted ? "accepted" : result?.reason === "network_error" ? "unknown" : "failed";
    prayerRequest.notificationProviderId = result?.accepted ? result.id || "" : "";
    prayerRequest.notificationFailure = result?.accepted ? "" : result?.providerCode || result?.reason || "provider_error";
    prayerRequest.lastNotificationAttemptAt = new Date();
    await prayerRequest.save();
    return res.status(200).json(new ApiResponse(200, result?.accepted
        ? "The provider accepted the confidential request notification; delivery is not confirmed."
        : "The prayer request remains saved, but its notification could not be accepted.", {
        reference: prayerRequest.reference, notificationStatus: prayerRequest.notificationStatus,
        notificationProviderId: prayerRequest.notificationProviderId || null,
        notificationFailure: prayerRequest.notificationFailure,
    }));
});

const getAllPrayerRequests = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.category && CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
    if (["pending", "received", "praying", "completed"].includes(req.query.status)) filter.status = req.query.status;
    const prayerRequests = await PrayerRequest.find(filter).sort({ createdAt: -1 });
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
    retryPrayerNotification,
    getAllPrayerRequests,
    getPrayerRequestById,
    updatePrayerRequest,
    deletePrayerRequest,
};
