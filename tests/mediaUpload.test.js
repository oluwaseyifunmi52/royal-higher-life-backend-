const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isAllowedMediaName, hasValidMediaSignature } = require("../Middleware/upload");

test("media upload allowlist matches supported file extensions and MIME types", () => {
    assert.equal(isAllowedMediaName("photo.webp", "image/webp"), true);
    assert.equal(isAllowedMediaName("recording.mp4", "video/mp4"), true);
    assert.equal(isAllowedMediaName("sermon.mp3", "audio/mpeg"), true);
    assert.equal(isAllowedMediaName("payload.exe", "video/mp4"), false);
    assert.equal(isAllowedMediaName("photo.jpg", "image/png"), false);
});

test("media uploads verify file signatures instead of trusting browser MIME values", () => {
    const mp4 = Buffer.alloc(16); mp4.write("ftyp", 4, "ascii");
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(hasValidMediaSignature({ buffer: mp4, mimetype: "video/mp4" }), true);
    assert.equal(hasValidMediaSignature({ buffer: webm, mimetype: "video/webm" }), true);
    assert.equal(hasValidMediaSignature({ buffer: png, mimetype: "image/png" }), true);
    assert.equal(hasValidMediaSignature({ buffer: Buffer.from("not a video"), mimetype: "video/mp4" }), false);
    assert.equal(hasValidMediaSignature({ buffer: png, mimetype: "image/jpeg" }), false);
});
