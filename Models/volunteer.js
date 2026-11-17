const mongoose = require("mongoose");
const { createSubmissionReference } = require("../utils/submissionReference");

const volunteerSchema = new mongoose.Schema(
    {
        submissionType: { type: String, enum: ["volunteer"], default: "volunteer" },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        reference: { type: String, unique: true, sparse: true, default: () => createSubmissionReference("volunteer") },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
        },
        phone: {
            type: String,
            default: "",
            trim: true,
        },
        ministry: {
            type: String,
            default: "",
            trim: true,
        },
        skills: {
            type: String,
            default: "",
            trim: true,
        },
        availability: {
            type: String,
            default: "",
            trim: true,
        },
        message: {
            type: String,
            default: "",
            trim: true,
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
        notificationStatus: { type: String, enum: ["pending", "accepted", "unknown", "failed", "partial"], default: "pending" },
        notificationProviderId: { type: String, default: "" },
        confirmationStatus: { type: String, enum: ["pending", "accepted", "unknown", "failed"], default: "pending" },
        notificationFailure: { type: String, default: "" },
        notificationAttemptCount: { type: Number, min: 0, default: 0 },
        lastNotificationAttemptAt: { type: Date, default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Volunteer", volunteerSchema);
