const mongoose = require("mongoose");

const prayerRequestSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        request: {
            type: String,
            required: true,
            trim: true,
        },
        category: {
            type: String,
            trim: true,
        },
        isPrivate: {
            type: Boolean,
            default: true,
        },
        isAnswered: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("PrayerRequest", prayerRequestSchema);
