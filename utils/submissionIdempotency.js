const crypto = require("node:crypto");
const mongoose = require("mongoose");

const SUBMISSION_KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;

function submissionIdFromKey(key, type = "prayer") {
    if (typeof key !== "string" || !SUBMISSION_KEY_PATTERN.test(key)) return null;
    // ObjectId's built-in unique index gives idempotency without adding a new
    // production index. Only the derived ID is stored; the client key is not.
    return new mongoose.Types.ObjectId(crypto.createHash("sha256").update(`${type}:${key}`).digest("hex").slice(0, 24));
}

module.exports = { SUBMISSION_KEY_PATTERN, submissionIdFromKey };
