const mongoose = require("mongoose");

const donationAuditSchema = new mongoose.Schema({
    donation: { type: mongoose.Schema.Types.ObjectId, ref: "Donation", default: null },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    eventId: { type: String, trim: true, sparse: true, unique: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model("DonationAudit", donationAuditSchema);
