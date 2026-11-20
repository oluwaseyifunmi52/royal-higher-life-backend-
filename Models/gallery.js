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
            default: "",
            trim: true,
        },
        mediaType: { type: String, enum: ["image", "video", "audio"], default: "image" },
        videoUrl: { type: String, trim: true, default: "" },
        mimeType: { type: String, trim: true, default: "" },
        fileName: { type: String, trim: true, default: "" },
        fileSize: { type: Number, min: 0, default: 0 },
        altText: { type: String, trim: true, default: "" },
        album: { type: String, trim: true, default: "" },
        sortOrder: { type: Number, default: 0 },
        isPublished: { type: Boolean, default: true },
        thumbnailUrl: { type: String, trim: true, default: "" },
        publicId: {
            type: String,
            trim: true,
        },
        resourceType: { type: String, enum: ["image", "video"], default: "image" },
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
