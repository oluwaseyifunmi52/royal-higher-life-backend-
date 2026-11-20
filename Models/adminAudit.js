const mongoose = require("mongoose");
const schema = new mongoose.Schema({
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true, trim: true },
    resource: { type: String, required: true, trim: true },
    resourceId: { type: String, trim: true, default: "" },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
schema.index({ resource: 1, resourceId: 1, createdAt: -1 });
module.exports = mongoose.model("AdminAudit", schema);
