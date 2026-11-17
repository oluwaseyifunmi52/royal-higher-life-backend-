const mongoose = require("mongoose");

const oauthTransactionSchema = new mongoose.Schema({
    purpose: {
        type: String,
        enum: ["state", "exchange"],
        required: true,
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true,
    },
    provider: {
        type: String,
        enum: ["google", "facebook"],
        required: true,
    },
    nonce: String,
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 },
    },
}, { timestamps: true });

module.exports = mongoose.model("OAuthTransaction", oauthTransactionSchema);
