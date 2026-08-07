const mongoose = require("mongoose");

const ministrySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },

        slug: {
            type: String,
            unique: true,
            lowercase: true,
        },

        description: {
            type: String,
            required: true,
        },

        leader: {
            type: String,
            default: "",
        },

        assistantLeader: {
            type: String,
            default: "",
        },

        image: {
            type: String,
            default: "",
        },

        meetingDay: {
            type: String,
            default: "",
        },

        meetingTime: {
            type: String,
            default: "",
        },

        meetingVenue: {
            type: String,
            default: "",
        },

        phone: {
            type: String,
            default: "",
        },

        email: {
            type: String,
            default: "",
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Ministry", ministrySchema);
