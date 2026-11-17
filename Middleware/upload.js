const multer = require("multer");
const path = require("path");
const crypto = require("node:crypto");
const { cloudinary } = require("../Config/cloudinary");

const fileFilter = (req, file, cb) => {
    const allowed = new Map([
        [".jpg", "image/jpeg"],
        [".jpeg", "image/jpeg"],
        [".png", "image/png"],
        [".gif", "image/gif"],
        [".webp", "image/webp"],
    ]);
    const extension = path.extname(file.originalname).toLowerCase();
    const isValid = allowed.get(extension) === file.mimetype;

    if (isValid) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed (jpg, jpeg, png, gif, webp)"));
    }
};

const hasValidImageSignature = (buffer, mimeType) => {
    if (!Buffer.isBuffer(buffer)) return false;
    if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (mimeType === "image/gif") return buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6));
    if (mimeType === "image/webp") return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    return false;
};

const createUploadMiddleware = (folder) => {
    const parseFile = multer({
        storage: multer.memoryStorage(),
        fileFilter,
        limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    });

    return {
        single(fieldName) {
            return (req, res, next) => parseFile.single(fieldName)(req, res, (parseError) => {
                if (parseError) return next(parseError);
                if (!req.file) return next();
                if (!hasValidImageSignature(req.file.buffer, req.file.mimetype)) {
                    return next(new Error("Only valid image file contents are allowed."));
                }

                const publicId = crypto.randomBytes(16).toString("hex");
                let settled = false;
                const finishUpload = (uploadError, result) => {
                    if (settled) return;
                    settled = true;
                    if (uploadError) return next(Object.assign(new Error("Image upload failed."), { code: "CLOUDINARY_UPLOAD_FAILED" }));
                    req.file.path = result.secure_url;
                    req.file.filename = result.public_id;
                    req.file.size = result.bytes;
                    delete req.file.buffer;
                    return next();
                };
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder, public_id: publicId, resource_type: "image" },
                    finishUpload
                );
                uploadStream.on("error", (error) => finishUpload(error));
                uploadStream.end(req.file.buffer);
            });
        },
    };
};

module.exports = {
    createUploadMiddleware,
    fileFilter,
    hasValidImageSignature,
};
