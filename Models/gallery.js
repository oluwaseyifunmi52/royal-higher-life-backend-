const mongoose = require("mongoose");

const gallerySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        imageUrl: {
            type: String,
            required: true,
            trim: true,
        },
        publicId: {
            type: String,
            trim: true,
        },
        category: {
            type: String,
            trim: true,
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Gallery", gallerySchema);
