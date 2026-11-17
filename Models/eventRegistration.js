const mongoose = require("mongoose");
const { createSubmissionReference } = require("../utils/submissionReference");

const eventRegistrationSchema = new mongoose.Schema(
    {
        submissionType: { type: String, enum: ["event_registration"], default: "event_registration" },
        reference: { type: String, unique: true, sparse: true, default: () => createSubmissionReference("event") },
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
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
        numberOfGuests: {
            type: Number,
            default: 1,
            min: 1,
        },
        status: {
            type: String,
            enum: ["confirmed", "pending", "cancelled"],
            default: "confirmed",
        },
        cancelTokenHash: { type: String, select: false },
        cancelTokenExpires: { type: Date, select: false },
        notificationStatus: { type: String, enum: ["pending", "accepted", "unknown", "failed", "partial"], default: "pending" },
        notificationProviderId: { type: String, default: "" },
        notificationFailure: { type: String, default: "" },
        notificationAttemptCount: { type: Number, min: 0, default: 0 },
        lastNotificationAttemptAt: { type: Date, default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model("EventRegistration", eventRegistrationSchema);
