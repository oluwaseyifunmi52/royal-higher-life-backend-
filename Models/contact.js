const mongoose = require("mongoose");
const { createSubmissionReference } = require("../utils/submissionReference");

const contactSchema = new mongoose.Schema(
    {
        submissionType: { type: String, enum: ["contact"], default: "contact" },
        name: { type: String, required: true, trim: true },
        reference: {
            type: String,
            unique: true,
            sparse: true,
            default: () => createSubmissionReference("contact"),
        },
        submissionKey: { type: String, unique: true, sparse: true, select: false },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
        },
        phone: { type: String, trim: true, default: "" },
        subject: { type: String, trim: true, default: "General Inquiry" },
        message: { type: String, required: true, trim: true },
        status: { type: String, enum: ["unread", "read", "resolved", "replied"], default: "unread" },
        internalNotes: { type: String, trim: true, maxlength: 5000, default: "" },
        notificationStatus: {
            type: String,
            enum: ["pending", "accepted", "unknown", "failed", "sent", "partial"],
            default: "pending",
        },
        notificationFailure: { type: String, default: "" },
        notificationProviderId: { type: String, default: "" },
        notificationAcceptedAt: { type: Date, default: null },
        notificationDeliveryStatus: {
            type: String,
            enum: ["unknown", "delivered", "bounced", "complained"],
            default: "unknown",
        },
        notificationAttemptCount: { type: Number, min: 0, default: 0 },
        lastNotificationAttemptAt: { type: Date, default: null },
        confirmationStatus: {
            type: String,
            enum: ["pending", "accepted", "unknown", "failed"],
            default: "pending",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Contact", contactSchema);
