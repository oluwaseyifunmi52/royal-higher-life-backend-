const mongoose = require("mongoose");
const { createSubmissionReference } = require("../utils/submissionReference");

const prayerRequestSchema = new mongoose.Schema(
    {
        submissionType: { type: String, enum: ["prayer"], default: "prayer" },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        reference: {
            type: String,
            unique: true,
            sparse: true,
            default: () => createSubmissionReference("prayer"),
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
        },
        phone: {
            type: String,
            trim: true,
        },
        request: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            trim: true,
            default: "General Prayer",
            enum: ["Healing", "Financial Breakthrough", "Family", "Spiritual Growth", "General Prayer"],
        },
        status: { type: String, enum: ["pending", "received", "praying", "completed"], default: "pending" },
        internalNotes: { type: String, trim: true, maxlength: 5000, default: "" },
        notificationStatus: { type: String, enum: ["pending", "accepted", "unknown", "sent", "partial", "failed"], default: "pending" },
        notificationProviderId: { type: String, default: "" },
        notificationFailure: { type: String, default: "" },
        notificationAttemptCount: { type: Number, min: 0, default: 0 },
        lastNotificationAttemptAt: { type: Date, default: null },
        confirmationStatus: { type: String, enum: ["pending", "accepted", "unknown", "failed"], default: "pending" },
        isPrivate: {
            type: Boolean,
            default: true,
        },
        isAnswered: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("PrayerRequest", prayerRequestSchema);
