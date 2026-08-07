const mongoose = require("mongoose");

const volunteerSchema = new mongoose.Schema(
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
    },
    { timestamps: true }
);

module.exports = mongoose.model("Volunteer", volunteerSchema);
