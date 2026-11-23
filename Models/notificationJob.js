const mongoose = require("mongoose");

const notificationJobSchema = new mongoose.Schema({
    _id: { type: String },
    kind: { type: String, enum: ["prayer-admin", "prayer-confirmation", "contact-admin", "contact-confirmation"], required: true },
    recordId: { type: mongoose.Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ["pending", "processing", "sent", "failed"], default: "pending" },
    attempts: { type: Number, min: 0, default: 0 },
    maxAttempts: { type: Number, min: 1, default: 8 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseUntil: { type: Date, default: null },
    providerId: { type: String, default: "" },
    lastErrorCode: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
});

notificationJobSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 }, { name: "notification_jobs_due" });
notificationJobSchema.index({ status: 1, leaseUntil: 1, attempts: 1 }, { name: "notification_jobs_expired_lease" });

// Job IDs are deterministic hashes of kind + submission ID. The built-in _id
// index provides uniqueness without requiring a production index migration.
module.exports = mongoose.models.NotificationJob || mongoose.model("NotificationJob", notificationJobSchema);
