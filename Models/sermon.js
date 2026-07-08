const mongoose = require("mongoose");

const sermonSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        preacher: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            required: true,
        },

        scripture: {
            type: String,
            default: "",
        },

        category: {
            type: String,
            default: "General",
        },

        image: {
            type: String,
            default: "",
        },

        audioUrl: {
            type: String,
            default: "",
        },

        videoUrl: {
            type: String,
            default: "",
        },

        sermonDate: {
            type: Date,
            default: Date.now,
        },

        isPublished: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Sermon", sermonSchema);
