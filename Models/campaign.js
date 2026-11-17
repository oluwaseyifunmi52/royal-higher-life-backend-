const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    coverImage: { type: String, trim: true, default: "" },
    targetAmount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, uppercase: true, enum: ["NGN"], default: "NGN" },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("Campaign", campaignSchema);
