const Volunteer = require("../Models/volunteer");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { sendAdminVolunteerNotification, sendVolunteerConfirmation } = require("../utils/mailer");

const notificationData = (volunteer) => ({
    id: volunteer.id, reference: volunteer.reference, name: volunteer.name, email: volunteer.email,
    phone: volunteer.phone, ministry: volunteer.ministry, skills: volunteer.skills,
    availability: volunteer.availability, message: volunteer.message, createdAt: volunteer.createdAt,
});

async function recordVolunteerNotifications(volunteer, retry = false) {
    const data = notificationData(volunteer);
    const [adminResult, confirmationResult] = await Promise.allSettled([
        sendAdminVolunteerNotification(data), sendVolunteerConfirmation(data),
    ]);
    const admin = adminResult.status === "fulfilled" ? adminResult.value : null;
    const confirmation = confirmationResult.status === "fulfilled" ? confirmationResult.value : null;
    volunteer.notificationStatus = admin?.accepted ? "accepted" : admin?.reason === "network_error" || adminResult.status === "rejected" ? "unknown" : "failed";
    volunteer.notificationProviderId = admin?.accepted ? admin.id || "" : "";
    volunteer.notificationFailure = admin?.accepted ? "" : admin?.providerCode || admin?.reason || "provider_error";
    volunteer.confirmationStatus = confirmation?.accepted ? "accepted" : confirmation?.reason === "network_error" || confirmationResult.status === "rejected" ? "unknown" : "failed";
    volunteer.notificationAttemptCount = (volunteer.notificationAttemptCount || 0) + 1;
    volunteer.lastNotificationAttemptAt = new Date();
    await volunteer.save();
    return admin;
}

const registerVolunteer = asyncHandler(async (req, res) => {
    const { name, email, phone, ministry, skills, availability, message } = req.body;

    if (!name || !email) {
        throw new ApiError(400, "Name and email are required");
    }

    const existing = await Volunteer.findOne({ email: email.toLowerCase() });

    if (existing) {
        return res.status(200).json(new ApiResponse(200, "You have already registered as a volunteer", existing));
    }

    const volunteer = await Volunteer.create({
        name,
        email,
        phone,
        ministry,
        skills,
        availability,
        message,
    });

    await recordVolunteerNotifications(volunteer);

    return res.status(201).json(new ApiResponse(201, "Volunteer registration successful", {
        reference: volunteer.reference,
        notificationStatus: volunteer.notificationStatus,
        confirmationStatus: volunteer.confirmationStatus,
    }));
});

const retryVolunteerNotification = asyncHandler(async (req, res) => {
    const volunteer = await Volunteer.findOneAndUpdate(
        { _id: req.params.id, notificationStatus: { $ne: "pending" } },
        { $set: { notificationStatus: "pending", notificationFailure: "" } },
        { returnDocument: 'after' }
    );
    if (!volunteer) {
        const exists = await Volunteer.exists({ _id: req.params.id });
        if (!exists) throw new ApiError(404, "Volunteer application not found");
        throw new ApiError(409, "A notification attempt is already in progress");
    }
    const result = await recordVolunteerNotifications(volunteer, true);
    return res.status(200).json(new ApiResponse(200, result?.accepted
        ? "The email provider accepted the volunteer notification; delivery is not confirmed."
        : "The application remains saved, but the notification could not be accepted.", {
        reference: volunteer.reference,
        notificationStatus: volunteer.notificationStatus,
        notificationProviderId: volunteer.notificationProviderId || null,
        notificationFailure: volunteer.notificationFailure,
    }));
});

const getAllVolunteers = asyncHandler(async (req, res) => {
    const volunteers = await Volunteer.find().sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Volunteers fetched", volunteers));
});

const updateVolunteerStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;

    if (!status || !["pending", "approved", "rejected"].includes(status)) {
        throw new ApiError(400, "Invalid status value. Must be: pending, approved, or rejected");
    }

    const volunteer = await Volunteer.findByIdAndUpdate(
        req.params.id,
        { status },
        { returnDocument: 'after', runValidators: true }
    );

    if (!volunteer) {
        throw new ApiError(404, "Volunteer not found");
    }

    return res.status(200).json(new ApiResponse(200, "Volunteer status updated", volunteer));
});

const deleteVolunteer = asyncHandler(async (req, res) => {
    const volunteer = await Volunteer.findByIdAndDelete(req.params.id);

    if (!volunteer) {
        throw new ApiError(404, "Volunteer not found");
    }

    return res.status(200).json(new ApiResponse(200, "Volunteer deleted", null));
});

module.exports = {
    registerVolunteer,
    retryVolunteerNotification,
    getAllVolunteers,
    updateVolunteerStatus,
    deleteVolunteer,
};
