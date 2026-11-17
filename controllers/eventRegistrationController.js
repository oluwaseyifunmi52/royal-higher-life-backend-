const mongoose = require("mongoose");
const crypto = require("node:crypto");
const EventRegistration = require("../Models/eventRegistration");
const Event = require("../Models/event");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { sendEventRegistrationConfirmation, sendAdminEventRegistrationNotification } = require("../utils/mailer");

async function recordRegistrationNotifications(registration, eventTitle, cancellationToken) {
    const notification = {
        id: registration.id, reference: registration.reference, name: registration.name, email: registration.email,
        phone: registration.phone, eventTitle, numberOfGuests: registration.numberOfGuests, createdAt: registration.createdAt,
    };
    const frontendUrl = (process.env.FRONTEND_URL || "https://royal-higher-life-ag25.vercel.app").replace(/\/$/, "");
    const cancelUrl = `${frontendUrl}/events/cancel/${registration._id}#token=${encodeURIComponent(cancellationToken)}`;
    const results = await Promise.allSettled([
        sendEventRegistrationConfirmation(registration.email, registration.name, eventTitle, registration._id, cancelUrl),
        sendAdminEventRegistrationNotification(notification),
    ]);
    const confirmation = results[0].status === "fulfilled" ? results[0].value : null;
    const admin = results[1].status === "fulfilled" ? results[1].value : null;
    registration.confirmationStatus = confirmation?.accepted ? "accepted" : confirmation?.reason === "network_error" || results[0].status === "rejected" ? "unknown" : "failed";
    registration.notificationStatus = admin?.accepted ? "accepted" : admin?.reason === "network_error" || results[1].status === "rejected" ? "unknown" : "failed";
    registration.notificationProviderId = admin?.accepted ? admin.id || "" : "";
    registration.notificationFailure = admin?.accepted ? "" : admin?.providerCode || admin?.reason || "provider_error";
    registration.notificationAttemptCount = (registration.notificationAttemptCount || 0) + 1;
    registration.lastNotificationAttemptAt = new Date();
    await registration.save();
}

const registerForEvent = asyncHandler(async (req, res) => {
    const { eventId, name, email, phone, numberOfGuests } = req.body;

    if (!eventId || typeof name !== "string" || !name.trim() || name.trim().length > 120 || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254) {
        throw new ApiError(400, "Enter a valid event, name, and email address.");
    }
    const guestCount = numberOfGuests === undefined ? 1 : Number(numberOfGuests);
    if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 10) {
        throw new ApiError(400, "Number of guests must be between 1 and 10.");
    }
    if (phone !== undefined && (typeof phone !== "string" || phone.length > 40)) {
        throw new ApiError(400, "Enter a valid phone number.");
    }

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
        throw new ApiError(400, "Invalid event ID format");
    }

    const event = await Event.findById(eventId);
    if (!event) {
        throw new ApiError(404, "Event not found");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await EventRegistration.exists({ event: eventId, email: normalizedEmail });
    if (existing) {
        return res.status(200).json(new ApiResponse(200, "If a registration matches those details, check the confirmation email for its details."));
    }

    const cancellationToken = crypto.randomBytes(32).toString("hex");
    const registration = await EventRegistration.create({
        event: eventId,
        name: String(name).trim().slice(0, 120),
        email: normalizedEmail,
        phone: String(phone || "").trim().slice(0, 40),
        numberOfGuests: guestCount,
        cancelTokenHash: crypto.createHash("sha256").update(cancellationToken).digest("hex"),
        cancelTokenExpires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    await recordRegistrationNotifications(registration, event.title, cancellationToken);

    const safeRegistration = registration.toObject();
    delete safeRegistration.cancelTokenHash;
    delete safeRegistration.cancelTokenExpires;
    delete safeRegistration.cancelToken;
    return res.status(201).json(new ApiResponse(201, "Registered for event successfully", safeRegistration));
});

const retryRegistrationNotification = asyncHandler(async (req, res) => {
    const cancellationToken = crypto.randomBytes(32).toString("hex");
    const registration = await EventRegistration.findOneAndUpdate(
        { _id: req.params.id, notificationStatus: { $ne: "pending" } },
        { $set: {
            notificationStatus: "pending", notificationFailure: "",
            cancelTokenHash: crypto.createHash("sha256").update(cancellationToken).digest("hex"),
            cancelTokenExpires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        } },
        { new: true }
    );
    if (!registration) {
        const exists = await EventRegistration.exists({ _id: req.params.id });
        if (!exists) throw new ApiError(404, "Event registration not found");
        throw new ApiError(409, "A notification attempt is already in progress");
    }
    const event = await Event.findById(registration.event);
    if (!event) throw new ApiError(404, "Event not found");
    const cancelUrl = `${(process.env.FRONTEND_URL || "https://royal-higher-life-ag25.vercel.app").replace(/\/$/, "")}/events/cancel/${registration._id}#token=${encodeURIComponent(cancellationToken)}`;
    const notification = { id: registration.id, reference: registration.reference, name: registration.name, email: registration.email, phone: registration.phone, eventTitle: event.title, numberOfGuests: registration.numberOfGuests, createdAt: registration.createdAt };
    const results = await Promise.allSettled([
        sendEventRegistrationConfirmation(registration.email, registration.name, event.title, registration._id, cancelUrl),
        sendAdminEventRegistrationNotification(notification),
    ]);
    const confirmation = results[0].status === "fulfilled" ? results[0].value : null;
    const admin = results[1].status === "fulfilled" ? results[1].value : null;
    registration.confirmationStatus = confirmation?.accepted ? "accepted" : confirmation?.reason === "network_error" || results[0].status === "rejected" ? "unknown" : "failed";
    registration.notificationStatus = admin?.accepted ? "accepted" : admin?.reason === "network_error" || results[1].status === "rejected" ? "unknown" : "failed";
    registration.notificationProviderId = admin?.accepted ? admin.id || "" : "";
    registration.notificationFailure = admin?.accepted ? "" : admin?.providerCode || admin?.reason || "provider_error";
    registration.notificationAttemptCount = (registration.notificationAttemptCount || 0) + 1;
    registration.lastNotificationAttemptAt = new Date();
    await registration.save();
    return res.status(200).json(new ApiResponse(200, admin?.accepted
        ? "The email provider accepted the ministry notification; delivery is not confirmed."
        : "The registration remains saved, but its notification could not be accepted.", {
        reference: registration.reference,
        notificationStatus: registration.notificationStatus,
        notificationProviderId: registration.notificationProviderId || null,
        notificationFailure: registration.notificationFailure,
    }));
});

const getEventRegistrations = asyncHandler(async (req, res) => {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
        throw new ApiError(400, "Invalid event ID format");
    }

    const registrations = await EventRegistration.find({ event: eventId })
        .populate("event", "title date")
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, "Registrations fetched", registrations));
});

const getAllRegistrations = asyncHandler(async (req, res) => {
    const registrations = await EventRegistration.find()
        .populate("event", "title date")
        .sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, "Registrations fetched", registrations));
});

const cancelRegistration = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid registration ID format");

    const isAdmin = req.user?.role === "admin";
    const token = String(req.body?.token || "");
    const selector = { _id: id, status: { $ne: "cancelled" } };
    if (!isAdmin) {
        if (!/^[a-f\d]{64}$/i.test(token)) throw new ApiError(403, "A valid cancellation link is required.");
        selector.cancelTokenHash = crypto.createHash("sha256").update(token).digest("hex");
        selector.cancelTokenExpires = { $gt: new Date() };
    }

    const registration = await EventRegistration.findOneAndUpdate(
        selector,
        { $set: { status: "cancelled" }, $unset: { cancelTokenHash: 1, cancelTokenExpires: 1 } },
        { new: true, runValidators: true }
    );
    if (!registration) throw new ApiError(404, "Registration not found or cancellation link invalid or expired.");

    return res.status(200).json(new ApiResponse(200, "Registration cancelled", { id: registration._id, status: registration.status }));
});

module.exports = {
    registerForEvent,
    getEventRegistrations,
    getAllRegistrations,
    cancelRegistration,
    retryRegistrationNotification,
};
