const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
    {
        donorName: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        amount: { type: Number, required: true },
        currency: { type: String, default: "USD" },
        paymentMethod: { type: String, trim: true },
        paymentReference: { type: String, trim: true },
        status: {
            type: String,
            enum: ["pending", "successful", "failed"],
            default: "pending",
        },
        donationType: {
            type: String,
            enum: ["one-time", "recurring"],
            default: "one-time",
        },
        isAnonymous: { type: Boolean, default: false },
        note: { type: String, trim: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Donation", donationSchema);
