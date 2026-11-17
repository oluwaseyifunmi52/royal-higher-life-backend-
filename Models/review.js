const mongoose = require("mongoose");
const { createSubmissionReference } = require("../utils/submissionReference");

const reviewSchema = new mongoose.Schema(
    {
        submissionType: { type: String, enum: ["testimony"], default: "testimony" },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            match: [/^$|^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/, "Please enter a valid email"],
        },
        title: { type: String, trim: true, maxlength: 120, default: "" },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        reference: {
            type: String,
            unique: true,
            sparse: true,
            default: () => createSubmissionReference("testimony"),
        },
        status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
        publicationConsent: { type: Boolean, default: false },
        isApproved: {
            type: Boolean,
            default: false,
        },
        notificationStatus: { type: String, enum: ["pending", "accepted", "unknown", "sent", "partial", "failed"], default: "pending" },
        notificationProviderId: { type: String, default: "" },
        notificationFailure: { type: String, default: "" },
        notificationAttemptCount: { type: Number, min: 0, default: 0 },
        lastNotificationAttemptAt: { type: Date, default: null },
        confirmationStatus: { type: String, enum: ["pending", "accepted", "unknown", "failed"], default: "pending" },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Review", reviewSchema);
