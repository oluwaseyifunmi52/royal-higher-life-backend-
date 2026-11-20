const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        date: {
            type: Date,
            required: true,
        },
        time: {
            type: String,
            trim: true,
        },
        location: {
            type: String,
            trim: true,
        },
        image: {
            type: String,
            trim: true,
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        isPublished: { type: Boolean, default: true },
        publishAt: { type: Date, default: null },
        registrationUrl: { type: String, trim: true, default: "" },
        registrationDeadline: { type: Date, default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
