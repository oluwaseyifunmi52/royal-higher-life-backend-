const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
    {
        submissionType: { type: String, enum: ["donation"], default: "donation" },
        donorName: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        amount: { type: Number, required: true, min: 1 },
        currency: { type: String, default: "NGN", trim: true },
        paymentMethod: { type: String, trim: true, default: "opay" },
        paymentReference: { type: String, trim: true },
        verifiedAt: { type: Date, default: null },
        campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", default: null },
        trackingCodeHash: { type: String, select: false },
        trackingCodeExpiresAt: { type: Date, select: false },
        trackingAttempts: { type: Number, default: 0, select: false },
        receiptSentAt: { type: Date, default: null },
        receiptNotificationStatus: { type: String, enum: ["pending", "accepted", "unknown", "failed"], default: "pending" },
        receiptProviderMessageId: { type: String, default: "" },
        receiptNotificationFailure: { type: String, default: "" },
        receiptNotificationAttemptCount: { type: Number, min: 0, default: 0 },
        receiptDeliveryStatus: { type: String, enum: ["unknown", "delivered", "bounced"], default: "unknown" },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        status: {
            type: String,
            enum: ["pending", "successful", "failed"],
            default: "pending",
        },
        donationType: {
            type: String,
            trim: true,
            enum: ["General Offering", "Church Planting", "Building Project", "Evangelism", "Mission Outreach", "Youth Ministry", "Children Ministry", "Bible Distribution", "Medical Outreach", "Community Support"],
            default: "General Offering",
        },
        isAnonymous: { type: Boolean, default: false },
        note: { type: String, trim: true },
    },
    { timestamps: true }
);

donationSchema.index({ status: 1, verifiedAt: 1, campaign: 1 });

module.exports = mongoose.model("Donation", donationSchema);
