const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
    {
        donorName: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },
        phone: { type: String, trim: true },
        amount: { type: Number, required: true, min: 1 },
        currency: { type: String, default: "NGN", trim: true },
        paymentMethod: { type: String, trim: true, default: "paystack" },
        paymentReference: { type: String, trim: true },
        status: {
            type: String,
            enum: ["pending", "successful", "failed"],
            default: "pending",
        },
        donationType: {
            type: String,
            trim: true,
            enum: ["General Offering", "Church Planting", "Building Project", "Evangelism"],
            default: "General Offering",
        },
        isAnonymous: { type: Boolean, default: false },
        note: { type: String, trim: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Donation", donationSchema);
