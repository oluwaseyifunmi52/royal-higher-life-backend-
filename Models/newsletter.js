const mongoose = require("mongoose");

const newsletterSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
        },
        firstName: {
            type: String,
            default: "",
            trim: true,
        },
        lastName: {
            type: String,
            default: "",
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        unsubscribeTokenHash: { type: String, select: false },
        unsubscribeTokenExpires: { type: Date, select: false },
        confirmationSentAt: { type: Date, select: false },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Newsletter", newsletterSchema);
