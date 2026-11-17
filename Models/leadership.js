const mongoose = require("mongoose");

const leadershipSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        title: { type: String, required: true, trim: true },
        bio: { type: String, required: true, trim: true },
        image: { type: String, trim: true, default: "" },
        responsibilities: { type: [String], default: [] },
        isPastor: { type: Boolean, default: false },
        isPublished: { type: Boolean, default: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Leadership", leadershipSchema);
