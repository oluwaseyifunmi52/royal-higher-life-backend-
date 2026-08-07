const mongoose = require("mongoose");

const partnershipSchema = new mongoose.Schema(
    {
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
        organization: {
            type: String,
            default: "",
            trim: true,
        },
        partnershipType: {
            type: String,
            enum: ["financial", "prayer", "media", "outreach", "other"],
            default: "financial",
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
    },
    { timestamps: true }
);

module.exports = mongoose.model("Partnership", partnershipSchema);
