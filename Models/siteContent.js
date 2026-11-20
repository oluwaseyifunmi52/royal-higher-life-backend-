const mongoose = require("mongoose");

const siteContentSchema = new mongoose.Schema({
    key: { type: String, default: "primary", unique: true },
    content: { type: mongoose.Schema.Types.Mixed, default: {} },
    draftContent: { type: mongoose.Schema.Types.Mixed, default: {} },
    publishedContent: { type: mongoose.Schema.Types.Mixed, default: {} },
    isPublished: { type: Boolean, default: false },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

module.exports = mongoose.model("SiteContent", siteContentSchema);
