const { test } = require("node:test");
const assert = require("node:assert/strict");
process.env.CLOUDINARY_CLOUD_NAME ||= "test-cloud";
const { fileFilter, hasValidImageSignature } = require("../Middleware/upload");

test("upload filter requires an exact image extension and MIME pairing", () => {
    const run = (file) => new Promise((resolve, reject) => {
        fileFilter({}, file, (error, accepted) => error ? reject(error) : resolve(accepted));
    });
    return Promise.all([
        run({ originalname: "photo.png", mimetype: "image/png" }).then((accepted) => assert.equal(accepted, true)),
        run({ originalname: "photo.png.exe", mimetype: "image/png" }).then(() => assert.fail("executable-style extension accepted"), () => {}),
        run({ originalname: "photo.png", mimetype: "application/x-png" }).then(() => assert.fail("mismatched MIME accepted"), () => {}),
    ]);
});


test("image signature verification rejects renamed non-image payloads", () => {
    assert.equal(hasValidImageSignature(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
    assert.equal(hasValidImageSignature(Buffer.from("MZ executable"), "image/png"), false);
    assert.equal(hasValidImageSignature(Buffer.from("GIF89a"), "image/gif"), true);
    assert.equal(hasValidImageSignature(Buffer.from("GIF89a"), "image/jpeg"), false);
});
