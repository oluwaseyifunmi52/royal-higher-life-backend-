const Contact = require("../Models/contact");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { sendContactConfirmation, sendAdminContactNotification } = require("../utils/mailer");

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const SUBMISSION_KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;
const SUBJECTS = ["Prayer Request", "Volunteer Inquiry", "Donation Inquiry", "General Question"];

function contactSubmissionResponse(contact, message, statusCode) {
    const accepted = contact.notificationStatus === "accepted" || contact.notificationStatus === "sent";
    return {
        ...new ApiResponse(statusCode, message, {
            reference: contact.reference,
            status: contact.status,
            notificationStatus: contact.notificationStatus,
            notificationDeliveryStatus: contact.notificationDeliveryStatus || "unknown",
            notificationProviderId: contact.notificationProviderId || null,
            confirmationStatus: contact.confirmationStatus || "unknown",
        }),
        emailNotificationsSent: accepted,
        emailNotificationAccepted: accepted,
    };
}
const createContact = asyncHandler(async (req, res) => {
    const { firstname, lastname, name, email, phone, subject, message } = req.body;
    const fullName = String(name || [firstname, lastname].filter(Boolean).join(" ")).trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const cleanMessage = String(message || "").trim();
    const cleanSubject = String(subject || "General Question").trim();
    const submissionKey = String(req.body.submissionKey || "").trim();

    if (!fullName || !normalizedEmail || !cleanMessage) {
        throw new ApiError(400, "Name, email, and message are required");
    }
    if (fullName.length > 120 || cleanMessage.length < 3 || cleanMessage.length > 10000) {
        throw new ApiError(400, "Please check the length of your name and message");
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
        throw new ApiError(400, "A valid email address is required");
    }
    if (!SUBJECTS.includes(cleanSubject)) throw new ApiError(400, "Select a valid contact subject");
    if (submissionKey && !SUBMISSION_KEY_PATTERN.test(submissionKey)) {
        throw new ApiError(400, "Invalid submission key");
    }

    if (submissionKey) {
        const existing = await Contact.findOne({ submissionKey });
        if (existing) {
            const messageText = existing.notificationStatus === "accepted"
                ? "Your enquiry has already been received successfully."
                : "Your enquiry has already been received and is available to our ministry team.";
            return res.status(200).json(contactSubmissionResponse(existing, messageText, 200));
        }
    }

    let contact;
    try {
        contact = await Contact.create({
        name: fullName,
        email: normalizedEmail,
        phone: String(phone || "").trim().slice(0, 40),
        subject: cleanSubject,
        message: cleanMessage,
        ...(submissionKey ? { submissionKey } : {}),
        });
    } catch (error) {
        if (submissionKey && error.code === 11000) {
            const existing = await Contact.findOne({ submissionKey });
            if (existing) return res.status(200).json(contactSubmissionResponse(existing, "Your enquiry has already been received.", 200));
        }
        throw error;
    }

    const notificationData = {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        subject: contact.subject,
        message: contact.message,
        reference: contact.reference,
        createdAt: contact.createdAt,
    };
    const [confirmationResult, ministryResult] = await Promise.allSettled([
        sendContactConfirmation(contact.email, contact.name, contact.reference, contact.id, contact.createdAt.toISOString()),
        sendAdminContactNotification(notificationData),
    ]);
    const ministryNotification = ministryResult.status === "fulfilled" ? ministryResult.value : null;
    const confirmation = confirmationResult.status === "fulfilled" ? confirmationResult.value : null;
    const emailNotificationsSent = ministryNotification?.accepted === true || ministryNotification?.sent === true;
    const ministryReason = ministryNotification?.reason || (ministryResult.status === "rejected" ? "provider_error" : "");
    contact.notificationStatus = emailNotificationsSent
        ? "accepted"
        : ministryReason === "network_error"
            ? "unknown"
            : "failed";
    contact.notificationFailure = emailNotificationsSent
        ? ""
        : ministryNotification?.providerCode
            ? `provider_${ministryNotification.providerCode}`
            : ministryNotification?.providerStatus
                ? `provider_rejected_${ministryNotification.providerStatus}`
                : ministryNotification?.networkCode
                    ? `network_${ministryNotification.networkCode}`
                    : ministryReason || "provider_error";
    contact.notificationProviderId = emailNotificationsSent ? ministryNotification.id || "" : "";
    contact.notificationAcceptedAt = emailNotificationsSent ? new Date() : null;
    contact.notificationDeliveryStatus = "unknown";
    contact.notificationAttemptCount = 1;
    contact.lastNotificationAttemptAt = new Date();
    contact.confirmationStatus = confirmation?.accepted === true || confirmation?.sent === true
        ? "accepted"
        : confirmation?.reason === "network_error" || confirmationResult.status === "rejected"
            ? "unknown"
            : "failed";
    await contact.save();
    if (!emailNotificationsSent) console.warn("Ministry contact notification was not accepted by the email provider.", { reference: contact.reference, status: contact.notificationStatus, reason: contact.notificationFailure });

    const messageText = emailNotificationsSent
        ? "Your enquiry has been received successfully."
        : "Your enquiry has been received successfully, but our email notification service is temporarily unavailable.";
    return res.status(201).json(contactSubmissionResponse(contact, messageText, 201));
});

const retryContactNotification = asyncHandler(async (req, res) => {
    const contact = await Contact.findOneAndUpdate(
        { _id: req.params.id, notificationStatus: { $ne: "pending" } },
        {
            $set: { notificationStatus: "pending", notificationFailure: "", lastNotificationAttemptAt: new Date() },
            $inc: { notificationAttemptCount: 1 },
        },
        { new: true }
    );
    if (!contact) {
        const exists = await Contact.exists({ _id: req.params.id });
        if (!exists) throw new ApiError(404, "Contact message not found");
        throw new ApiError(409, "A notification attempt is already in progress");
    }

    const result = await sendAdminContactNotification({
        id: contact.id,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        subject: contact.subject,
        message: contact.message,
        reference: contact.reference,
        createdAt: contact.createdAt,
    });
    const accepted = result?.accepted === true || result?.sent === true;
    contact.notificationStatus = accepted ? "accepted" : result?.reason === "network_error" ? "unknown" : "failed";
    contact.notificationFailure = accepted
        ? ""
        : result?.providerCode
            ? `provider_${result.providerCode}`
            : result?.providerStatus
                ? `provider_rejected_${result.providerStatus}`
                : result?.networkCode
                    ? `network_${result.networkCode}`
                    : result?.reason || "provider_error";
    contact.notificationProviderId = accepted ? result.id || "" : "";
    contact.notificationAcceptedAt = accepted ? new Date() : null;
    contact.notificationDeliveryStatus = "unknown";
    await contact.save();

    return res.status(200).json(new ApiResponse(200, accepted
        ? "The email provider accepted the ministry notification; delivery status is not confirmed."
        : "The ministry notification could not be accepted. The enquiry remains saved.", {
        reference: contact.reference,
        notificationStatus: contact.notificationStatus,
        notificationFailure: contact.notificationFailure,
        notificationProviderId: contact.notificationProviderId || null,
        notificationDeliveryStatus: contact.notificationDeliveryStatus,
    }));
});

const getContacts = asyncHandler(async (req, res) => {
    const filter = req.query.subject && SUBJECTS.includes(req.query.subject) ? { subject: req.query.subject } : {};
    const contacts = await Contact.find(filter).sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, "Contacts fetched", contacts));
});

const updateContactStatus = asyncHandler(async (req, res) => {
    const update = {};
    if (req.body.status !== undefined) {
        if (!["unread", "read", "resolved", "replied"].includes(req.body.status)) {
            throw new ApiError(400, "A valid contact status is required");
        }
        update.status = req.body.status;
    }
    if (req.body.internalNotes !== undefined) {
        const notes = String(req.body.internalNotes).trim();
        if (notes.length > 5000) throw new ApiError(400, "Internal notes must be 5000 characters or fewer");
        update.internalNotes = notes;
    }
    if (Object.keys(update).length === 0) throw new ApiError(400, "No supported contact fields were provided");
    const contact = await Contact.findByIdAndUpdate(
        req.params.id,
        update,
        { new: true, runValidators: true }
    );
    if (!contact) throw new ApiError(404, "Contact message not found");
    return res.status(200).json(new ApiResponse(200, "Contact status updated", contact));
});

const deleteContact = asyncHandler(async (req, res) => {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) throw new ApiError(404, "Contact message not found");
    return res.status(200).json(new ApiResponse(200, "Contact message deleted", null));
});

module.exports = { createContact, getContacts, updateContactStatus, retryContactNotification, deleteContact };
