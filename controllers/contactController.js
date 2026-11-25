const Contact = require("../Models/contact");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/apiError");
const ApiResponse = require("../utils/apiResponse");
const { submissionIdFromKey } = require("../utils/submissionIdempotency");
const { enqueueSubmissionNotifications, enqueueNotification, resetFailedJob, attachAdminNotificationStatuses } = require("../services/notificationOutbox");

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
        emailNotificationQueued: contact.notificationStatus === "pending",
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
            await enqueueSubmissionNotifications("contact", existing._id);
            const messageText = existing.notificationStatus === "accepted"
                ? "Your enquiry has already been received successfully."
                : "Your enquiry has already been received and is available to our ministry team.";
            return res.status(200).json(contactSubmissionResponse(existing, messageText, 200));
        }
    }

    let contact;
    try {
        contact = await Contact.create({
        ...(submissionKey ? { _id: submissionIdFromKey(submissionKey, "contact") } : {}),
        name: fullName,
        email: normalizedEmail,
        phone: String(phone || "").trim().slice(0, 40),
        subject: cleanSubject,
        message: cleanMessage,
        ...(submissionKey ? { submissionKey } : {}),
        });
    } catch (error) {
        if (submissionKey && error.code === 11000) {
            const existing = await Contact.findOne({ submissionKey }) || await Contact.findById(submissionIdFromKey(submissionKey, "contact"));
            if (existing) {
                await enqueueSubmissionNotifications("contact", existing._id);
                return res.status(200).json(contactSubmissionResponse(existing, "Your enquiry has already been received.", 200));
            }
        }
        throw error;
    }

    await enqueueSubmissionNotifications("contact", contact._id);

    return res.status(201).json(contactSubmissionResponse(contact, "Your enquiry has been received successfully and queued for notification.", 201));
});

const retryContactNotification = asyncHandler(async (req, res) => {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
        throw new ApiError(404, "Contact message not found");
    }
    const jobId = await enqueueNotification("contact-admin", contact._id);
    const reset = await resetFailedJob("contact-admin", contact._id);
    if (!reset) {
        const job = await require("../Models/notificationJob").findById(jobId).lean();
        if (job?.status === "sent") throw new ApiError(409, "The notification was already accepted by the provider");
        if (job?.status === "processing") throw new ApiError(409, "A notification attempt is already in progress");
    }
    contact.notificationStatus = "pending";
    contact.notificationFailure = "";
    await contact.save();

    return res.status(202).json(new ApiResponse(202, "The ministry notification was queued for retry.", {
        reference: contact.reference,
        notificationStatus: "pending",
        notificationJobId: jobId,
    }));
});

const getContacts = asyncHandler(async (req, res) => {
    const filter = req.query.subject && SUBJECTS.includes(req.query.subject) ? { subject: req.query.subject } : {};
    const contacts = await Contact.find(filter).sort({ createdAt: -1 });
    const visibleContacts = await attachAdminNotificationStatuses("contact", contacts);
    return res.status(200).json(new ApiResponse(200, "Contacts fetched", visibleContacts));
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
        { returnDocument: 'after', runValidators: true }
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
